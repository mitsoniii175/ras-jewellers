// Fulfilment operations, as plain server functions.
//
// These are the building blocks the Admin Dashboard will call. They are NOT
// exposed as public HTTP endpoints — the only shipping routes reachable from
// the internet are the customer's own read-only tracking view and the
// provider's signed webhook.
//
// Every function is a no-op with a clear reason when Shiprocket is not
// configured, so the site works perfectly well without it: orders simply
// progress through the internal statuses and no tracking is claimed.

import { parcelWeightKg } from "@/lib/shipping-rules";
import { findOrder, indexShipment, updateOrder } from "./repo";
import {
  assignAwb,
  createShiprocketOrder,
  generateLabel,
  requestPickup,
  shiprocketConfig,
  trackByAwb,
} from "./shiprocket";
import {
  isTerminalStatus,
  ORDER_STATUSES,
  type Order,
  type OrderStatus,
  type Shipment,
  type TrackingEvent,
} from "./types";

export type ShippingOutcome<T = void> =
  { ok: true; value: T } | { ok: false; reason: string; notConfigured?: boolean };

function notConfigured<T>(): ShippingOutcome<T> {
  return {
    ok: false,
    notConfigured: true,
    reason:
      "Shipping is not connected yet. Add SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD to enable shipment creation and live tracking.",
  };
}

/* ------------------------------------------------------- status mapping -- */

/**
 * Maps a courier's status text onto our fulfilment ladder.
 *
 * Deliberately conservative: anything we do not recognise leaves the order
 * where it is rather than guessing. An unmapped status is recorded verbatim on
 * the shipment as `providerStatus` so support can still see it.
 */
export function mapCourierStatus(raw: string): OrderStatus | null {
  const status = raw.trim().toLowerCase();

  if (!status) return null;
  if (status.includes("delivered")) return "Delivered";
  if (status.includes("out for delivery")) return "Out for Delivery";
  if (
    status.includes("in transit") ||
    status.includes("shipped") ||
    status.includes("dispatch") ||
    status.includes("picked up") ||
    status.includes("pickup complete")
  ) {
    return "Shipped";
  }
  if (
    status.includes("pickup") ||
    status.includes("manifest") ||
    status.includes("ready to ship")
  ) {
    return "Packed";
  }
  if (status.includes("cancel")) return "Cancelled";
  if (status.includes("rto") || status.includes("return")) return "Returned";

  return null;
}

/** Never move an order backwards along the ladder from a courier update. */
function shouldAdvance(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return false;
  // A terminal state (Cancelled/Returned) always wins and always sticks.
  if (isTerminalStatus(next)) return true;
  if (isTerminalStatus(current)) return false;

  const ladder = ORDER_STATUSES as readonly string[];
  return ladder.indexOf(next) > ladder.indexOf(current);
}

function appendEvent(events: TrackingEvent[] | undefined, event: TrackingEvent): TrackingEvent[] {
  const list = events ?? [];
  // Idempotent: the same status is never recorded twice.
  if (list.some((e) => e.status === event.status)) return list;
  return [...list, event];
}

/* ---------------------------------------------------- create a shipment -- */

/**
 * Registers a paid order with the courier and assigns an AWB.
 *
 * Refuses to run for an unpaid order — dispatching before payment is confirmed
 * is a business risk, not a technical one.
 */
export async function createShipmentForOrder(
  userId: string,
  orderId: string,
): Promise<ShippingOutcome<Shipment>> {
  const config = shiprocketConfig();
  if (!config) return notConfigured();

  const order = await findOrder(userId, orderId);
  if (!order) return { ok: false, reason: "Order not found." };

  if (order.paymentStatus !== "Paid") {
    return { ok: false, reason: "This order has not been paid for yet." };
  }
  if (order.shipment?.awb) {
    return { ok: false, reason: `A shipment already exists (AWB ${order.shipment.awb}).` };
  }
  if (isTerminalStatus(order.status)) {
    return { ok: false, reason: `This order is ${order.status.toLowerCase()}.` };
  }

  const now = new Date().toISOString();

  try {
    const created = await createShiprocketOrder(config, {
      orderId: order.id,
      placedAt: order.placedAt,
      billing: {
        name: order.address.fullName,
        address: order.address.street,
        address2: order.address.area,
        city: order.address.city,
        state: order.address.state,
        pincode: order.address.pincode,
        phone: order.address.phone,
        email: order.customerEmail ?? "",
      },
      items: order.items.map((item) => ({
        name: item.name,
        sku: item.code,
        units: item.qty,
        sellingPrice: item.price,
      })),
      subtotal: order.subtotal,
      weightKg: parcelWeightKg(order.items),
      paymentMethod: "Prepaid",
    });

    let shipment: Shipment = {
      provider: "shiprocket",
      providerOrderId: created.order_id ? String(created.order_id) : undefined,
      shipmentId: created.shipment_id ? String(created.shipment_id) : undefined,
      providerStatus: created.status,
      createdAt: now,
      updatedAt: now,
    };

    // Assign a courier so we have a real AWB to show the customer.
    if (created.shipment_id) {
      try {
        const awbResult = await assignAwb(config, created.shipment_id);
        const data = awbResult.response?.data;
        if (data?.awb_code) {
          shipment = {
            ...shipment,
            awb: data.awb_code,
            courier: data.courier_name,
            estimatedDelivery: data.expected_delivery_date,
            trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(data.awb_code)}`,
          };
        }
      } catch (error) {
        // The order exists at the courier; only the AWB step failed. Keep the
        // shipment so it can be retried rather than creating a duplicate order.
        shipment.error = error instanceof Error ? error.message : "AWB assignment failed.";
      }
    }

    await updateOrder(userId, order.id, (current) => ({
      ...current,
      shipment,
      status: shouldAdvance(current.status, "Processing") ? "Processing" : current.status,
      tracking: {
        events: appendEvent(current.tracking?.events, {
          status: "Processing",
          at: now,
          source: "internal",
        }),
      },
    }));

    if (shipment.awb) await indexShipment(shipment.awb, { userId, orderId: order.id });

    return { ok: true, value: shipment };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not create the shipment.",
    };
  }
}

/* ------------------------------------------------------------- label ---- */

export async function generateShippingLabel(
  userId: string,
  orderId: string,
): Promise<ShippingOutcome<string>> {
  const config = shiprocketConfig();
  if (!config) return notConfigured();

  const order = await findOrder(userId, orderId);
  if (!order?.shipment?.shipmentId) {
    return { ok: false, reason: "Create the shipment first." };
  }

  try {
    const result = await generateLabel(config, Number(order.shipment.shipmentId));
    if (!result.label_url) return { ok: false, reason: "The provider did not return a label." };

    await updateOrder(userId, orderId, (current) => ({
      ...current,
      shipment: current.shipment
        ? { ...current.shipment, labelUrl: result.label_url, updatedAt: new Date().toISOString() }
        : current.shipment,
    }));

    return { ok: true, value: result.label_url };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Label generation failed.",
    };
  }
}

/* ------------------------------------------------------------ pickup ---- */

export async function schedulePickup(
  userId: string,
  orderId: string,
): Promise<ShippingOutcome<string>> {
  const config = shiprocketConfig();
  if (!config) return notConfigured();

  const order = await findOrder(userId, orderId);
  if (!order?.shipment?.shipmentId) return { ok: false, reason: "Create the shipment first." };

  try {
    const result = await requestPickup(config, Number(order.shipment.shipmentId));
    const scheduled = result.response?.pickup_scheduled_date ?? "";
    const now = new Date().toISOString();

    await updateOrder(userId, orderId, (current) => ({
      ...current,
      status: shouldAdvance(current.status, "Packed") ? "Packed" : current.status,
      shipment: current.shipment ? { ...current.shipment, updatedAt: now } : current.shipment,
      tracking: {
        events: appendEvent(current.tracking?.events, {
          status: "Packed",
          at: now,
          note: scheduled ? `Courier pickup scheduled for ${scheduled}` : undefined,
          source: "internal",
        }),
      },
    }));

    return { ok: true, value: scheduled };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Pickup request failed." };
  }
}

/* ----------------------------------------------------------- tracking --- */

/**
 * Pulls the latest courier status for an order and folds it into our timeline.
 *
 * This is the ONLY way tracking data enters the system besides the webhook —
 * there is no synthetic progress anywhere.
 */
export async function refreshTracking(
  userId: string,
  orderId: string,
): Promise<ShippingOutcome<Order>> {
  const config = shiprocketConfig();
  if (!config) return notConfigured();

  const order = await findOrder(userId, orderId);
  if (!order) return { ok: false, reason: "Order not found." };
  if (!order.shipment?.awb) {
    return { ok: false, reason: "This order has not been dispatched yet." };
  }

  try {
    const result = await trackByAwb(config, order.shipment.awb);
    const data = result.tracking_data;
    const track = data?.shipment_track?.[0];
    const rawStatus = track?.current_status ?? "";
    const mapped = mapCourierStatus(rawStatus);
    const now = new Date().toISOString();

    const updated = await updateOrder(userId, orderId, (current) => {
      const advance = mapped && shouldAdvance(current.status, mapped);
      return {
        ...current,
        status: advance ? mapped : current.status,
        shipment: current.shipment
          ? {
              ...current.shipment,
              courier: track?.courier_name ?? current.shipment.courier,
              estimatedDelivery: track?.edd ?? current.shipment.estimatedDelivery,
              deliveredAt: track?.delivered_date ?? current.shipment.deliveredAt,
              trackingUrl: data?.track_url ?? current.shipment.trackingUrl,
              providerStatus: rawStatus || current.shipment.providerStatus,
              updatedAt: now,
            }
          : current.shipment,
        tracking: {
          events: advance
            ? appendEvent(current.tracking?.events, {
                status: mapped,
                at: now,
                note: rawStatus || undefined,
                source: "courier",
              })
            : (current.tracking?.events ?? []),
        },
      };
    });

    if (!updated) return { ok: false, reason: "Order not found." };
    return { ok: true, value: updated };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Tracking lookup failed.",
    };
  }
}

/* ----------------------------------------------- manual status movement -- */

/**
 * Moves an order along the ladder by hand (the showroom marking Quality Check
 * done, for example). Rejects impossible jumps so the timeline stays coherent.
 */
export async function setOrderStatus(
  userId: string,
  orderId: string,
  next: OrderStatus,
  note?: string,
): Promise<ShippingOutcome<Order>> {
  const order = await findOrder(userId, orderId);
  if (!order) return { ok: false, reason: "Order not found." };

  if (order.status === next) return { ok: true, value: order };
  if (isTerminalStatus(order.status)) {
    return { ok: false, reason: `This order is already ${order.status.toLowerCase()}.` };
  }
  if (!isTerminalStatus(next) && !shouldAdvance(order.status, next)) {
    return {
      ok: false,
      reason: `Cannot move an order from "${order.status}" back to "${next}".`,
    };
  }

  const now = new Date().toISOString();
  const updated = await updateOrder(userId, orderId, (current) => ({
    ...current,
    status: next,
    tracking: {
      events: appendEvent(current.tracking?.events, {
        status: next,
        at: now,
        note,
        source: "internal",
      }),
    },
  }));

  if (!updated) return { ok: false, reason: "Order not found." };
  return { ok: true, value: updated };
}
