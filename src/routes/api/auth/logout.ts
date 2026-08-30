import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { clearedSessionCookie, json } from "@/lib/server/http";
import { endSession, route } from "@/lib/server/session";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        // Delete the server-side record too, so the token can't be replayed
        // even if a copy of the cookie was captured earlier.
        await endSession(request);
        return json({ ok: true }, { headers: { "set-cookie": clearedSessionCookie(request) } });
      }),
    },
  },
});
