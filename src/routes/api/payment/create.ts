import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json, readJsonBody } from "@/lib/server/http";
import { createRazorpayOrder, isTestMode, razorpayConfig, toPaise } from "@/lib/server/razorpay";
import { findOrder, indexRazorpayOrder, updateOrder } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

type Body = { orderId?: string };

/**
 * Starts a payment for an order that already exists.
 *
 * The amount comes from OUR stored order, never from the request — the browser
 * only names which of its own orders it wants to pay for.
 */
export const Route = createFileRoute("/api/payment/create")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const user = await requireUser(request);

        const config = razorpayConfig();
        if (!config) {
          // No keys configured — say so plainly instead of half-working.
          return fail(
            "Online payment is not available yet. Please choose Pay at Showroom, or contact us to complete your order.",
            503,
          );
        }

        const body = await readJsonBody<Body>(request);
        if (!body?.orderId) return fail("Invalid request.");

        // Scoped to this customer, so another account's order is simply absent.
        const order = await findOrder(user.id, body.orderId);
        if (!order) return fail("Order not found.", 404);

        // Never re-charge something already settled.
        if (order.paymentStatus === "Paid") {
          return fail("This order has already been paid for.", 409);
        }

        const amountPaise = toPaise(order.total);
        if (amountPaise <= 0) {
          return fail("This order cannot be paid online. Please enquire on WhatsApp.", 400);
        }

        let rzpOrder;
        try {
          rzpOrder = await createRazorpayOrder(config, {
            amountPaise,
            receipt: order.id,
            notes: { rasOrderId: order.id, customerId: user.id },
          });
        } catch (error) {
          // createRazorpayOrder has already logged the provider detail. Surface
          // only its safe, customer-facing message — never the raw response.
          return fail(error instanceof Error ? error.message : "Could not start the payment.", 502);
        }

        // Remember the mapping so a webhook can find this order later, and
        // record the attempt against the order itself.
        await indexRazorpayOrder(rzpOrder.id, { userId: user.id, orderId: order.id });
        await updateOrder(user.id, order.id, (current) => ({
          ...current,
          payment: {
            provider: "razorpay",
            razorpayOrderId: rzpOrder.id,
            amountPaise,
            attempts: (current.payment?.attempts ?? 0) + 1,
            createdAt: current.payment?.createdAt ?? new Date().toISOString(),
          },
          // A fresh attempt moves a previously failed payment back to Pending.
          paymentStatus: current.paymentStatus === "Paid" ? "Paid" : "Pending",
        }));

        // keyId is safe to expose — Checkout needs it. keySecret never is.
        return json({
          ok: true,
          keyId: config.keyId,
          testMode: isTestMode(config),
          razorpayOrderId: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          orderId: order.id,
          customer: { name: user.name, email: user.email, contact: user.phone },
        });
      }),
    },
  },
});
