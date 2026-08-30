import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json, readJsonBody } from "@/lib/server/http";
import {
  fetchRazorpayPayment,
  razorpayConfig,
  verifyPaymentSignature,
} from "@/lib/server/razorpay";
import { onOrderPaid } from "@/lib/server/order-fulfilment";
import { findOrder, updateOrder } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

type Body = {
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  signature?: string;
  /** Set by the browser when the customer dismissed the Razorpay modal. */
  cancelled?: boolean;
  failureReason?: string;
};

/**
 * Confirms (or records the failure of) a payment.
 *
 * The browser calling this and saying "it worked" proves nothing. An order is
 * only marked Paid after BOTH:
 *   1. the HMAC signature verifies against our key secret, and
 *   2. Razorpay's own API confirms the payment is captured, for our exact
 *      amount, against our exact Razorpay order.
 */
export const Route = createFileRoute("/api/payment/verify")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        if (!body?.orderId) return fail("Invalid request.");

        const order = await findOrder(user.id, body.orderId);
        if (!order) return fail("Order not found.", 404);

        // Already settled (perhaps by the webhook, which often wins the race).
        // Report success rather than trying to pay again.
        if (order.paymentStatus === "Paid") {
          return json({ ok: true, status: "Paid", alreadyPaid: true });
        }

        /* ------------------------------------------ cancelled by customer -- */
        if (body.cancelled) {
          await updateOrder(user.id, order.id, (current) => ({
            ...current,
            paymentStatus: "Cancelled",
            payment: current.payment
              ? { ...current.payment, failureReason: "Cancelled by customer" }
              : current.payment,
          }));
          return json({ ok: true, status: "Cancelled" });
        }

        const config = razorpayConfig();
        if (!config) return fail("Online payment is not configured.", 503);

        /* -------------------------------------- failure reported by client -- */
        if (!body.razorpayPaymentId || !body.signature || !body.razorpayOrderId) {
          await updateOrder(user.id, order.id, (current) => ({
            ...current,
            paymentStatus: "Failed",
            payment: current.payment
              ? {
                  ...current.payment,
                  failureReason: (body.failureReason ?? "Payment was not completed").slice(0, 200),
                }
              : current.payment,
          }));
          return json({ ok: true, status: "Failed" });
        }

        /* ------------------------------------------------- 1. signature -- */
        // The razorpay order id must be the one WE created for this order —
        // otherwise a valid signature from some other order would pass.
        if (order.payment?.razorpayOrderId !== body.razorpayOrderId) {
          console.warn("[ras/payment] razorpay order id mismatch for", order.id);
          return fail("We could not verify this payment.", 400);
        }

        const signatureValid = await verifyPaymentSignature({
          razorpayOrderId: body.razorpayOrderId,
          razorpayPaymentId: body.razorpayPaymentId,
          signature: body.signature,
          keySecret: config.keySecret,
        });

        if (!signatureValid) {
          console.warn("[ras/payment] INVALID SIGNATURE for order", order.id);
          await updateOrder(user.id, order.id, (current) => ({
            ...current,
            paymentStatus: "Failed",
            payment: current.payment
              ? { ...current.payment, failureReason: "Signature verification failed" }
              : current.payment,
          }));
          return fail("We could not verify this payment.", 400);
        }

        /* --------------------------------------- 2. confirm with Razorpay -- */
        const payment = await fetchRazorpayPayment(config, body.razorpayPaymentId);

        if (!payment) {
          // Could not reach Razorpay. Do NOT mark paid on a guess — leave it
          // pending; the webhook will settle it.
          return json({ ok: true, status: "Pending", pendingVerification: true });
        }

        const amountMatches = payment.amount === order.payment?.amountPaise;
        const orderMatches = payment.order_id === body.razorpayOrderId;

        if (payment.status !== "captured" || !amountMatches || !orderMatches) {
          const reason =
            payment.status !== "captured"
              ? `Payment status was ${payment.status}`
              : !amountMatches
                ? "Amount mismatch"
                : "Order mismatch";
          console.warn("[ras/payment] refusing to mark paid:", reason, order.id);

          // "authorized" but not captured is still money in flight, not taken.
          const status = payment.status === "authorized" ? "Pending" : "Failed";
          await updateOrder(user.id, order.id, (current) => ({
            ...current,
            paymentStatus: status,
            payment: current.payment
              ? { ...current.payment, razorpayPaymentId: payment.id, failureReason: reason }
              : current.payment,
          }));
          return json({ ok: true, status });
        }

        /* ------------------------------------------------------ 3. paid -- */
        const now = new Date().toISOString();
        await updateOrder(user.id, order.id, (current) => ({
          ...current,
          paymentStatus: "Paid",
          // Order status advances only now that the money is confirmed.
          status: current.status === "Order Placed" ? "Payment Confirmed" : current.status,
          payment: current.payment
            ? {
                ...current.payment,
                razorpayPaymentId: payment.id,
                method: payment.method,
                paidAt: now,
                failureReason: undefined,
              }
            : current.payment,
          tracking: current.tracking
            ? {
                ...current.tracking,
                events: [...current.tracking.events, { status: "Payment Confirmed", at: now }],
              }
            : current.tracking,
        }));

        // Payment is real: deduct stock exactly once.
        await onOrderPaid(user.id, order.id);

        return json({ ok: true, status: "Paid" });
      }),
    },
  },
});
