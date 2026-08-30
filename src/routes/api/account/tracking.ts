import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json } from "@/lib/server/http";
import { findOrder } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";
import { refreshTracking } from "@/lib/server/shipping";

/**
 * Live tracking for ONE of the signed-in customer's own orders.
 *
 * Scoped by session userId, so an AWB or order id belonging to someone else is
 * simply not found. This is the only shipping endpoint a customer can reach.
 */
export const Route = createFileRoute("/api/account/tracking")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        const orderId = new URL(request.url).searchParams.get("orderId");
        if (!orderId) return fail("Invalid request.");

        const order = await findOrder(user.id, orderId);
        if (!order) return fail("Order not found.", 404);

        // No shipment yet: report the internal timeline honestly rather than
        // implying the courier has it.
        if (!order.shipment?.awb) {
          return json({
            ok: true,
            dispatched: false,
            status: order.status,
            events: order.tracking?.events ?? [],
          });
        }

        const result = await refreshTracking(user.id, orderId);

        // Provider unreachable or not configured — fall back to what we know,
        // and say that it is our stored view rather than a live one.
        if (!result.ok) {
          return json({
            ok: true,
            dispatched: true,
            live: false,
            reason: result.reason,
            status: order.status,
            shipment: order.shipment,
            events: order.tracking?.events ?? [],
          });
        }

        return json({
          ok: true,
          dispatched: true,
          live: true,
          status: result.value.status,
          shipment: result.value.shipment,
          events: result.value.tracking?.events ?? [],
        });
      }),
    },
  },
});
