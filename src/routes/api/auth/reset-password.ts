import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { hashPassword, hashToken } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { consumeReset, findUserById, saveUser } from "@/lib/server/repo";
import { route } from "@/lib/server/session";
import { validatePassword } from "@/lib/validation";

type Body = { token?: string; password?: string; confirmPassword?: string };

export const Route = createFileRoute("/api/auth/reset-password")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const body = await readJsonBody<Body>(request);
        if (!body?.token) return fail("This reset link is invalid or has expired.");

        const password = body.password ?? "";
        const invalid = validatePassword(password);
        if (invalid) return fail(invalid, 400, "password");
        if (password !== (body.confirmPassword ?? "")) {
          return fail("Passwords do not match.", 400, "confirmPassword");
        }

        // Single-use: consumeReset deletes the token whether or not it's valid.
        const record = await consumeReset(await hashToken(body.token));
        if (!record) return fail("This reset link is invalid or has expired.", 400);

        const user = await findUserById(record.userId);
        if (!user) return fail("This reset link is invalid or has expired.", 400);

        await saveUser({ ...user, passwordHash: await hashPassword(password) });

        // Note: existing sessions stay valid. Log the customer in explicitly
        // from the login page so they confirm the new password works.
        return json({ ok: true, message: "Your password has been updated. Please log in." });
      }),
    },
  },
});
