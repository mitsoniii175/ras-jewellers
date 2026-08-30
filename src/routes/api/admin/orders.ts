import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { allOrders, findOrderAnywhere } from "@/lib/server/admin-queries";
import { requireAdmin } from "@/lib/server/admin-session";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { restoreStockForOrder } from "@/lib/server/product-service";
import { route } from "@/lib/server/session";
import { setOrderStatus } from "@/lib/server/shipping";
import { ORDER_STATUSES, TERMINAL_STATUSES, type OrderStatus } from "@/lib/server/types";

type UpdateBody = { orderId?: string; status?: OrderStatus; note?: string };

const VALID_STATUSES: readonly string[] = [...ORDER_STATUSES, ...TERMINAL_STATUSES];

export const Route = createFileRoute("/api/admin/orders")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "orders.view");
        const id = new URL(request.url).searchParams.get("id");

        if (id) {
          const found = await findOrderAnywhere(id);
          if (!found) return fail("Order not found.", 404);
          return json({ ok: true, order: found.order });
        }

        return json({ ok: true, orders: await allOrders() });
      }),

      PUT: route(async ({ request }) => {
        const admin = await requireAdmin(request, "orders.update");
        const body = await readJsonBody<UpdateBody>(request);
        if (!body?.orderId || !body.status) return fail("Invalid request.");

        if (!VALID_STATUSES.includes(body.status)) {
          return fail("Unknown order status.", 400, "status");
        }

        // Cancelling is a heavier permission than routine status movement.
        const cancelling = body.status === "Cancelled" || body.status === "Returned";
        if (cancelling) await requireAdmin(request, "orders.cancel");

        const found = await findOrderAnywhere(body.orderId);
        if (!found) return fail("Order not found.", 404);

        // setOrderStatus rejects impossible transitions (backwards moves, or
        // anything after a terminal state).
        const result = await setOrderStatus(
          found.userId,
          body.orderId,
          body.status,
          body.note?.slice(0, 200),
        );
        if (!result.ok) return fail(result.reason, 400);

        // Cancelling or returning a paid order puts its stock back, with an
        // audit movement for each piece.
        if (cancelling && found.order.stockDeducted) {
          await restoreStockForOrder(
            body.orderId,
            found.order.items.map((i) => ({ code: i.code, qty: i.qty })),
            body.status === "Returned" ? "Return" : "Cancellation",
            { id: admin.id, name: admin.name },
          );
        }

        return json({ ok: true, order: result.value });
      }),
    },
  },
});
