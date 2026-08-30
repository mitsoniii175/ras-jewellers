import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { json } from "@/lib/server/http";
import { razorpayConfig, verifyWebhookSignature } from "@/lib/server/razorpay";
import { onOrderPaid } from "@/lib/server/order-fulfilment";
import { lookupRazorpayOrder, updateOrder } from "@/lib/server/repo";
import { route } from "@/lib/server/session";

/**
 * Razorpay webhook receiver.
 *
 * This is the authoritative settlement path: it fires even if the customer
 * closed the tab mid-payment, lost signal, or the browser callback never ran.
 *
 * Configure in the Razorpay Dashboard > Settings > Webhooks:
 *   URL     https://<your-domain>/api/payment/webhook
 *   Secret  the same value as RAZORPAY_WEBHOOK_SECRET
 *   Events  payment.captured, payment.failed, order.paid
 *
 * NOTE: this route is intentionally NOT session-protected — Razorpay is not a
 * logged-in browser. Its authentication is the HMAC signature over the raw
 * body, which is checked before anything is read from the payload.
 */

type WebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        status?: string;
        method?: string;
        error_description?: string;
      };
    };
  };
};

export const Route = createFileRoute("/api/payment/webhook")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const config = razorpayConfig();
        if (!config?.webhookSecret) {
          console.error("[ras/payment] webhook received but RAZORPAY_WEBHOOK_SECRET is not set");
          return json({ ok: false }, { status: 503 });
        }

        // The signature covers the EXACT bytes, so read the body as text and
        // never re-serialise it before verifying.
        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";

        const valid = await verifyWebhookSignature({
          rawBody,
          signature,
          webhookSecret: config.webhookSecret,
        });

        if (!valid) {
          console.warn("[ras/payment] rejected webhook with a bad signature");
          return json({ ok: false }, { status: 401 });
        }

        let payload: WebhookPayload;
        try {
          payload = JSON.parse(rawBody) as WebhookPayload;
        } catch {
          return json({ ok: false }, { status: 400 });
        }

        const entity = payload.payload?.payment?.entity;
        const razorpayOrderId = entity?.order_id;
        if (!razorpayOrderId) return json({ ok: true, ignored: "no order id" });

        // Which of our orders is this? The index was written when we created
        // the Razorpay order.
        const entry = await lookupRazorpayOrder(razorpayOrderId);
        if (!entry) {
          console.warn("[ras/payment] webhook for an unknown razorpay order", razorpayOrderId);
          return json({ ok: true, ignored: "unknown order" });
        }

        const event = payload.event ?? "";
        const now = new Date().toISOString();

        await updateOrder(entry.userId, entry.orderId, (order) => {
          // Idempotent: Razorpay retries webhooks, and the browser callback may
          // already have settled this. Never double-apply.
          if (order.paymentStatus === "Paid") return order;

          if (event === "payment.captured" || event === "order.paid") {
            // Amount must match what we asked for.
            if (entity?.amount !== undefined && order.payment?.amountPaise !== entity.amount) {
              console.warn("[ras/payment] webhook amount mismatch for", order.id);
              return order;
            }
            return {
              ...order,
              paymentStatus: "Paid",
              status: order.status === "Order Placed" ? "Payment Confirmed" : order.status,
              payment: order.payment
                ? {
                    ...order.payment,
                    razorpayPaymentId: entity?.id ?? order.payment.razorpayPaymentId,
                    method: entity?.method ?? order.payment.method,
                    paidAt: now,
                    failureReason: undefined,
                  }
                : order.payment,
              tracking: order.tracking
                ? {
                    ...order.tracking,
                    events: order.tracking.events.some((e) => e.status === "Payment Confirmed")
                      ? order.tracking.events
                      : [...order.tracking.events, { status: "Payment Confirmed", at: now }],
                  }
                : order.tracking,
            };
          }

          if (event === "payment.failed") {
            return {
              ...order,
              paymentStatus: "Failed",
              payment: order.payment
                ? {
                    ...order.payment,
                    razorpayPaymentId: entity?.id ?? order.payment.razorpayPaymentId,
                    failureReason: (entity?.error_description ?? "Payment failed").slice(0, 200),
                  }
                : order.payment,
            };
          }

          return order;
        });

        // If this webhook is what confirmed the payment, deduct stock. The
        // helper is idempotent, so racing the browser callback is harmless.
        if (event === "payment.captured" || event === "order.paid") {
          await onOrderPaid(entry.userId, entry.orderId);
        }

        // Always 200 for a verified webhook, or Razorpay will keep retrying.
        return json({ ok: true });
      }),
    },
  },
});
