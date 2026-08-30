import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { hashPassword, normalizeEmail } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { indexCustomer } from "@/lib/server/admin-repo";
import { createUser, findUserByEmail } from "@/lib/server/repo";
import { route, startSession } from "@/lib/server/session";
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
  password?: string;
  confirmPassword?: string;
};

export const Route = createFileRoute("/api/auth/signup")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const body = await readJsonBody<Body>(request);
        if (!body) return fail("Invalid request.");

        const name = (body.name ?? "").trim();
        const phone = digitsOnly(body.phone ?? "");
        const email = normalizeEmail(body.email ?? "");
        const password = body.password ?? "";

        // Re-validate everything server-side.
        const checks: [string, string | null][] = [
          ["name", validateName(name)],
          ["phone", validatePhone(phone)],
          ["email", validateEmail(email)],
          ["password", validatePassword(password)],
        ];
        for (const [field, message] of checks) {
          if (message) return fail(message, 400, field);
        }
        if (password !== (body.confirmPassword ?? "")) {
          return fail("Passwords do not match.", 400, "confirmPassword");
        }

        if (await findUserByEmail(email)) {
          return fail(
            "An account already exists with this email. Try logging in instead.",
            409,
            "email",
          );
        }

        const user = await createUser({
          name,
          phone,
          email,
          passwordHash: await hashPassword(password),
        });

        // Add to the directory the admin customer list reads.
        await indexCustomer(user.id);

        return json(
          { ok: true, customer: toPublicCustomer(user) },
          { headers: { "set-cookie": await startSession(request, user.id) } },
        );
      }),
    },
  },
});
