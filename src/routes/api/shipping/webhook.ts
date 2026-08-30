import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { timingSafeEqual } from "@/lib/server/crypto";
import { json } from "@/lib/server/http";
import { eventForStatus, notifyCustomer } from "@/lib/server/notifications";
import { findUserById, lookupShipment, updateOrder } from "@/lib/server/repo";
import { route } from "@/lib/server/session";
import { mapCourierStatus } from "@/lib/server/shipping";
import { shiprocketConfig } from "@/lib/server/shiprocket";
import { isTerminalStatus, ORDER_STATUSES, type OrderStatus } from "@/lib/server/types";

/**
 * Shiprocket status webhook.
 *
 * Configure in Shiprocket Dashboard > Settings > API > Webhooks:
 *   URL    https://<your-domain>/api/shipping/webhook
 *   Token  the same value as SHIPROCKET_WEBHOOK_TOKEN
 *
 * Shiprocket authenticates with a shared token in the `x-api-key` header rather
 * than an HMAC over the body, so that token is the whole of the authentication
 * here — it must be long and random. The token is compared in constant time and
 * checked before any of the payload is read.
 */

type ShiprocketWebhookPayload = {
  awb?: string;
  current_status?: string;
  order_id?: string;
  courier_name?: string;
  etd?: string;
  scans?: { date?: string; activity?: string; location?: string }[];
};

export const Route = createFileRoute("/api/shipping/webhook")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const config = shiprocketConfig();
        if (!config?.webhookToken) {
          console.error("[ras/shipping] webhook received but SHIPROCKET_WEBHOOK_TOKEN is not set");
          return json({ ok: false }, { status: 503 });
        }

        const provided = request.headers.get("x-api-key") ?? "";
        if (!timingSafeEqual(provided, config.webhookToken)) {
          console.warn("[ras/shipping] rejected webhook with a bad token");
          return json({ ok: false }, { status: 401 });
        }

        let payload: ShiprocketWebhookPayload;
        try {
          payload = (await request.json()) as ShiprocketWebhookPayload;
        } catch {
          return json({ ok: false }, { status: 400 });
        }

        const awb = payload.awb?.trim();
        if (!awb) return json({ ok: true, ignored: "no awb" });

        // Which of our orders is this? The index was written when the AWB was
        // assigned, so an unknown AWB is not ours to act on.
        const entry = await lookupShipment(awb);
        if (!entry) {
          console.warn("[ras/shipping] webhook for an unknown AWB", awb);
          return json({ ok: true, ignored: "unknown awb" });
        }

        const raw = payload.current_status ?? "";
        const mapped = mapCourierStatus(raw);
        const now = new Date().toISOString();

        const updated = await updateOrder(entry.userId, entry.orderId, (order) => {
          const ladder = ORDER_STATUSES as readonly string[];

          // Never move backwards, and never overwrite a terminal state.
          const canAdvance =
            mapped !== null &&
            mapped !== order.status &&
            !isTerminalStatus(order.status) &&
            (isTerminalStatus(mapped) || ladder.indexOf(mapped) > ladder.indexOf(order.status));

          const next: OrderStatus = canAdvance ? mapped : order.status;
          const events = order.tracking?.events ?? [];

          return {
            ...order,
            status: next,
            shipment: order.shipment
              ? {
                  ...order.shipment,
                  courier: payload.courier_name ?? order.shipment.courier,
                  estimatedDelivery: payload.etd ?? order.shipment.estimatedDelivery,
                  deliveredAt: mapped === "Delivered" ? now : order.shipment.deliveredAt,
                  shippedAt:
                    mapped === "Shipped"
                      ? (order.shipment.shippedAt ?? now)
                      : order.shipment.shippedAt,
                  // Always record the courier's own words, even when unmapped.
                  providerStatus: raw || order.shipment.providerStatus,
                  updatedAt: now,
                }
              : order.shipment,
            tracking: {
              events:
                canAdvance && !events.some((e) => e.status === next)
                  ? [
                      ...events,
                      { status: next, at: now, note: raw || undefined, source: "courier" as const },
                    ]
                  : events,
            },
          };
        });

        if (!updated) return json({ ok: true, ignored: "order missing" });

        // Tell the customer, if a notification channel is configured.
        const milestone = mapped ? eventForStatus(mapped) : null;
        if (milestone && updated.status === mapped) {
          const user = await findUserById(entry.userId);
          if (user) {
            await notifyCustomer(milestone, updated, { phone: user.phone, email: user.email });
          }
        }

        // Always 200 for an authenticated webhook so the provider stops retrying.
        return json({ ok: true, status: updated.status });
      }),
    },
  },
});
