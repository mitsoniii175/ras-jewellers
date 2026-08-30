import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { clearedAdminCookie, currentAdmin, endAdminSession } from "@/lib/server/admin-session";
import { toPublicAdmin } from "@/lib/server/admin-types";
import { json } from "@/lib/server/http";
import { route } from "@/lib/server/session";

export const Route = createFileRoute("/api/admin/session")({
  server: {
    handlers: {
      /** Who is signed in, and what may they do? */
      GET: route(async ({ request }) => {
        const admin = await currentAdmin(request);
        return json({ ok: true, admin: admin ? toPublicAdmin(admin) : null });
      }),

      DELETE: route(async ({ request }) => {
        await endAdminSession(request);
        return json({ ok: true }, { headers: { "set-cookie": clearedAdminCookie(request) } });
      }),
    },
  },
});
