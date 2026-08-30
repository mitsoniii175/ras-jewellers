import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json, readJsonBody } from "@/lib/server/http";
import { readCart, writeCart, type StoredCartLine } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

type Body = { lines?: unknown; merge?: boolean };

const MAX_QTY_PER_LINE = 99;

/**
 * Only `{ productId, qty }` is ever stored — never a price. Prices are resolved
 * from the catalogue when the bag is rendered and, at checkout, recalculated on
 * the server, so a tampered payload cannot set what a customer pays.
 */
function sanitize(value: unknown): StoredCartLine[] | null {
  if (!Array.isArray(value)) return null;

  const lines: StoredCartLine[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const { productId, qty } = entry as { productId?: unknown; qty?: unknown };
    if (typeof productId !== "string" || !/^[a-z0-9-]{1,64}$/.test(productId)) continue;
    if (typeof qty !== "number" || !Number.isFinite(qty)) continue;

    const clamped = Math.min(MAX_QTY_PER_LINE, Math.max(1, Math.floor(qty)));
    lines.push({ productId, qty: clamped });
  }

  return lines.slice(0, 100);
}

export const Route = createFileRoute("/api/account/cart")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        return json({ ok: true, lines: await readCart(user.id) });
      }),

      PUT: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        const incoming = sanitize(body?.lines);
        if (!incoming) return fail("Invalid request.");

        // merge:true folds a guest bag into the account bag at login.
        const next = body?.merge ? [...(await readCart(user.id)), ...incoming] : incoming;
        return json({ ok: true, lines: await writeCart(user.id, next) });
      }),
    },
  },
});
