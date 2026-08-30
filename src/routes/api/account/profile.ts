import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { findUserByEmail, reindexEmail, saveUser } from "@/lib/server/repo";
import { requireUser, route } from "@/lib/server/session";
import { toPublicCustomer } from "@/lib/server/types";
import {
  digitsOnly,
  validateEmail,
  validateName,
  validatePassword,
  validatePhone,
} from "@/lib/validation";

type Body = {
  name?: string;
  phone?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export const Route = createFileRoute("/api/account/profile")({
  server: {
    handlers: {
      // The session cookie decides whose profile this is — the client cannot
      // name a different customer.
      GET: route(async ({ request }) => {
        const user = await requireUser(request);
        return json({ ok: true, customer: toPublicCustomer(user) });
      }),

      PUT: route(async ({ request }) => {
        const user = await requireUser(request);
        const body = await readJsonBody<Body>(request);
        if (!body) return fail("Invalid request.");

        const name = (body.name ?? user.name).trim();
        const phone = digitsOnly(body.phone ?? user.phone);
        const email = normalizeEmail(body.email ?? user.email);

        const checks: [string, string | null][] = [
          ["name", validateName(name)],
          ["phone", validatePhone(phone)],
          ["email", validateEmail(email)],
        ];
        for (const [field, message] of checks) {
          if (message) return fail(message, 400, field);
        }

        const emailChanged = email !== user.email;
        if (emailChanged) {
          const clash = await findUserByEmail(email);
          if (clash && clash.id !== user.id) {
            return fail("That email is already used by another account.", 409, "email");
          }
        }

        let passwordHash = user.passwordHash;
        if (body.newPassword) {
          // Changing a password requires proving you know the current one,
          // so a borrowed logged-in browser can't be used to lock the owner out.
          if (!(await verifyPassword(body.currentPassword ?? "", user.passwordHash))) {
            return fail("Your current password is incorrect.", 400, "currentPassword");
          }
          const invalid = validatePassword(body.newPassword);
          if (invalid) return fail(invalid, 400, "newPassword");
          if (body.newPassword !== (body.confirmPassword ?? "")) {
            return fail("Passwords do not match.", 400, "confirmPassword");
          }
          passwordHash = await hashPassword(body.newPassword);
        }

        const updated = await saveUser({ ...user, name, phone, email, passwordHash });
        if (emailChanged) await reindexEmail(user.email, email, user.id);

        return json({ ok: true, customer: toPublicCustomer(updated) });
      }),
    },
  },
});
