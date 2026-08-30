import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { allCustomers } from "@/lib/server/admin-queries";
import { requireAdmin } from "@/lib/server/admin-session";
import { json } from "@/lib/server/http";
import { route } from "@/lib/server/session";

/**
 * Customer directory. Returns name, email, mobile, registration date, order
 * count and lifetime value — and nothing else.
 *
 * There is deliberately NO endpoint anywhere that returns a password hash.
 * Admins cannot view or recover a password by any route; they can only ask the
 * customer to use the reset flow.
 */
export const Route = createFileRoute("/api/admin/customers")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "customers.view");
        return json({ ok: true, customers: await allCustomers() });
      }),
    },
  },
});
