import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { fail, json, readJsonBody } from "@/lib/server/http";
import {
  buildOrder,
  validateAndPriceOrder,
  type RequestedLine,
} from "@/lib/server/order-validation";
import {
  appendOrders,
  findOrder,
  findOrderIdForKey,
  listAddresses,
  rememberOrderForKey,
  writeCart,
} from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";

type PreviewBody = { lines?: RequestedLine[] };
type PlaceBody = {
  lines?: RequestedLine[];
  addressId?: string;
  paymentMethod?: string;
  /** Generated once per checkout attempt by the browser. */
  idempotencyKey?: string;
};

const PAYMENT_METHODS = ["Pay Online", "Pay at Showroom"];

export const Route = createFileRoute("/api/account/checkout")({
  server: {
    handlers: {
      /**
       * Dry run. Prices the bag exactly as the real thing would, so the review
       * screen shows server-calculated figures rather than the browser's.
       */
      POST: route(async ({ request }) => {
        await requireUser(request);
        const body = await readJsonBody<PreviewBody>(request);
        const result = await validateAndPriceOrder(body?.lines ?? []);

        if (!result.ok) {
          return json(
            {
              ok: false,
              error: result.failure.message,
              code: result.failure.code,
              productId: result.failure.productId,
            },
            { status: 400 },
          );
        }
        return json({ ok: true, order: result.order });
      }),

      /** Creates the order for real. */
      PUT: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<PlaceBody>(request);
        if (!body) return fail("Invalid request.");

        // Replay protection: if this exact attempt already produced an order,
        // hand back that order rather than creating a second one.
        const key =
          typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 64) : null;
        if (key) {
          const existingId = await findOrderIdForKey(user.id, key);
          if (existingId) {
            const existing = await findOrder(user.id, existingId);
            if (existing) return json({ ok: true, order: existing, replayed: true });
          }
        }

        const paymentMethod = body.paymentMethod ?? "";
        if (!PAYMENT_METHODS.includes(paymentMethod)) {
          return fail("Please choose a payment method.", 400, "paymentMethod");
        }

        // The address must be one of THIS customer's saved addresses — an id
        // from someone else's account simply is not found.
        const addresses = await listAddresses(user.id);
        const address = addresses.find((a) => a.id === body.addressId);
        if (!address) return fail("Please choose a delivery address.", 400, "addressId");

        // Re-validate and re-price at the moment of purchase: stock and prices
        // may have moved since the review screen was rendered.
        const result = await validateAndPriceOrder(body.lines ?? []);
        if (!result.ok) {
          return json(
            {
              ok: false,
              error: result.failure.message,
              code: result.failure.code,
              productId: result.failure.productId,
            },
            { status: 409 },
          );
        }

        const order = buildOrder({
          validated: result.order,
          address,
          paymentMethod,
          customerEmail: user.email,
        });
        await appendOrders(user.id, [order]);
        if (key) await rememberOrderForKey(user.id, key, order.id);

        // The bag has become an order — empty it so a refresh cannot reorder.
        await writeCart(user.id, []);

        return json({ ok: true, order });
      }),
    },
  },
});
