import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json, readJsonBody } from "@/lib/server/http";
import { readWishlist, writeWishlist } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

type Body = { productIds?: unknown; merge?: boolean };

function sanitize(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter(
    (v): v is string => typeof v === "string" && /^[a-z0-9-]{1,64}$/.test(v),
  );
  return ids.slice(0, 500);
}

/**
 * The wishlist is stored against the account, which is what makes it follow a
 * customer from their phone to their laptop. Guests keep a local copy in
 * localStorage; `merge: true` folds that into the account at login time.
 */
export const Route = createFileRoute("/api/account/wishlist")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        return json({ ok: true, productIds: await readWishlist(user.id) });
      }),

      PUT: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        const incoming = sanitize(body?.productIds);
        if (!incoming) return fail("Invalid request.");

        const next = body?.merge ? [...(await readWishlist(user.id)), ...incoming] : incoming;
        return json({ ok: true, productIds: await writeWishlist(user.id, next) });
      }),
    },
  },
});
