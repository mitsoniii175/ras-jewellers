import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { newId } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { listAddresses, saveAddresses } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";
import type { Address } from "@/lib/server/types";
import { digitsOnly, validateAddress, type AddressInput } from "@/lib/validation";

type Body = Partial<AddressInput> & { id?: string; isDefault?: boolean };

const MAX_ADDRESSES = 15;

function clean(body: Body): AddressInput {
  return {
    fullName: (body.fullName ?? "").trim(),
    phone: digitsOnly(body.phone ?? ""),
    street: (body.street ?? "").trim(),
    area: (body.area ?? "").trim(),
    city: (body.city ?? "").trim(),
    state: (body.state ?? "").trim(),
    pincode: digitsOnly(body.pincode ?? ""),
  };
}

/** Applies "only one default" across the whole list. */
function withDefault(list: Address[], defaultId: string): Address[] {
  return list.map((a) => ({ ...a, isDefault: a.id === defaultId }));
}

export const Route = createFileRoute("/api/account/addresses")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        return json({ ok: true, addresses: await listAddresses(user.id) });
      }),

      POST: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        if (!body) return fail("Invalid request.");

        const input = clean(body);
        const errors = validateAddress(input);
        if (errors.length) return fail(errors[0].message, 400, errors[0].field);

        const existing = await listAddresses(user.id);
        if (existing.length >= MAX_ADDRESSES) {
          return fail(`You can save up to ${MAX_ADDRESSES} addresses.`, 400);
        }

        const address: Address = {
          ...input,
          id: newId("adr"),
          // First address saved is automatically the default.
          isDefault: body.isDefault === true || existing.length === 0,
          createdAt: new Date().toISOString(),
        };

        const next = address.isDefault
          ? withDefault([...existing, address], address.id)
          : [...existing, address];

        return json({ ok: true, addresses: await saveAddresses(user.id, next) });
      }),

      PUT: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        if (!body?.id) return fail("Invalid request.");

        // Scoped to this customer's own list, so an id from another account
        // simply isn't found.
        const existing = await listAddresses(user.id);
        const current = existing.find((a) => a.id === body.id);
        if (!current) return fail("That address no longer exists.", 404);

        // `isDefault`-only update (the "Set as default" button).
        if (body.fullName === undefined && body.isDefault === true) {
          return json({
            ok: true,
            addresses: await saveAddresses(user.id, withDefault(existing, current.id)),
          });
        }

        const input = clean(body);
        const errors = validateAddress(input);
        if (errors.length) return fail(errors[0].message, 400, errors[0].field);

        const makeDefault = body.isDefault === true;
        const updated: Address = {
          ...current,
          ...input,
          isDefault: makeDefault || current.isDefault,
        };
        let next = existing.map((a) => (a.id === updated.id ? updated : a));
        if (makeDefault) next = withDefault(next, updated.id);

        return json({ ok: true, addresses: await saveAddresses(user.id, next) });
      }),

      DELETE: route(async ({ request }) => {
        const user = await requireUser(request);
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return fail("Invalid request.");

        const existing = await listAddresses(user.id);
        const target = existing.find((a) => a.id === id);
        if (!target) return fail("That address no longer exists.", 404);

        let next = existing.filter((a) => a.id !== id);
        // Deleting the default promotes the next address in the list.
        if (target.isDefault && next.length > 0) next = withDefault(next, next[0].id);

        return json({ ok: true, addresses: await saveAddresses(user.id, next) });
      }),
    },
  },
});
