import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json } from "@/lib/server/http";
import { findOrder, listOrders } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

/**
 * Read-only. Orders are created by the checkout flow
 * (src/routes/api/account/checkout.ts) and updated by the payment endpoints
 * under src/routes/api/payment/.
 */
export const Route = createFileRoute("/api/account/orders")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        const id = new URL(request.url).searchParams.get("id");

        // Both reads are scoped to the session's userId, so one customer can
        // never fetch another customer's order by guessing its id.
        if (id) {
          const order = await findOrder(user.id, id);
          if (!order) return fail("Order not found.", 404);
          return json({ ok: true, order });
        }

        return json({ ok: true, orders: await listOrders(user.id) });
      }),
    },
  },
});
