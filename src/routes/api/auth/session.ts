import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { json } from "@/lib/server/http";
import { currentUser, route } from "@/lib/server/session";
import { toPublicCustomer } from "@/lib/server/types";

/** Who am I? Called once on boot so the UI knows whether to show the account. */
export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await currentUser(request);
        return json({ ok: true, customer: user ? toPublicCustomer(user) : null });
      }),
    },
  },
});
