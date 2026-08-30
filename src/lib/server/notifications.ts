// Customer notifications for fulfilment milestones.
//
// Nothing is sent unless a provider is actually configured. Every function here
// is a deliberate no-op otherwise — the alternative (pretending to notify) is
// worse than silence, because the showroom would believe customers had been
// told when they had not.
//
// TO ENABLE, set the env vars for whichever channel you use:
//   WhatsApp : WHATSAPP_API_URL, WHATSAPP_API_TOKEN, WHATSAPP_FROM
//   SMS      : SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID   (e.g. MSG91)
//   Email    : EMAIL_API_URL, EMAIL_API_KEY, EMAIL_FROM  (e.g. Resend)
//
// Then fill in the send* functions below with that provider's request shape.
// The call sites and the decision of WHEN to notify are already wired up.

import type { Order, OrderStatus } from "./types";

export type NotifiableEvent =
  "order_confirmed" | "order_shipped" | "out_for_delivery" | "delivered";

/** Which fulfilment statuses are worth interrupting a customer for. */
const EVENT_FOR_STATUS: Partial<Record<OrderStatus, NotifiableEvent>> = {
  "Payment Confirmed": "order_confirmed",
  Shipped: "order_shipped",
  "Out for Delivery": "out_for_delivery",
  Delivered: "delivered",
};

export function eventForStatus(status: OrderStatus): NotifiableEvent | null {
  return EVENT_FOR_STATUS[status] ?? null;
}

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

export type ChannelStatus = { whatsapp: boolean; sms: boolean; email: boolean };

export function configuredChannels(): ChannelStatus {
  return {
    whatsapp: Boolean(env("WHATSAPP_API_URL") && env("WHATSAPP_API_TOKEN")),
    sms: Boolean(env("SMS_API_URL") && env("SMS_API_KEY")),
    email: Boolean(env("EMAIL_API_URL") && env("EMAIL_API_KEY")),
  };
}

/** The message a customer would receive for each milestone. */
export function messageFor(event: NotifiableEvent, order: Order): string {
  const awb = order.shipment?.awb;
  const courier = order.shipment?.courier;

  switch (event) {
    case "order_confirmed":
      return `RAS Jewellers: thank you! Your payment for order ${order.id} is confirmed. We'll let you know as soon as it ships.`;
    case "order_shipped":
      return awb
        ? `RAS Jewellers: order ${order.id} has been dispatched via ${courier ?? "our courier"}. Tracking number ${awb}.`
        : `RAS Jewellers: order ${order.id} has been dispatched.`;
    case "out_for_delivery":
      return `RAS Jewellers: order ${order.id} is out for delivery today. Please keep your phone handy.`;
    case "delivered":
      return `RAS Jewellers: order ${order.id} has been delivered. We hope you love it — thank you for choosing us.`;
  }
}

/**
 * Sends a milestone notification on every configured channel.
 *
 * Never throws: a notification failure must not roll back a delivery update.
 * Returns which channels actually sent.
 */
export async function notifyCustomer(
  event: NotifiableEvent,
  order: Order,
  recipient: { phone: string; email?: string },
): Promise<{ sent: string[]; skipped: string[] }> {
  const channels = configuredChannels();
  const message = messageFor(event, order);
  const sent: string[] = [];
  const skipped: string[] = [];

  for (const [channel, enabled] of Object.entries(channels)) {
    if (!enabled) {
      skipped.push(channel);
      continue;
    }
    try {
      // TODO(notifications): replace with the provider's real call. The
      // decision logic, message copy and recipients above are already correct.
      console.info(`[ras/notify] ${channel} -> ${recipient.phone}: ${message}`);
      sent.push(channel);
    } catch (error) {
      console.error(`[ras/notify] ${channel} failed`, error);
      skipped.push(channel);
    }
  }

  return { sent, skipped };
}
