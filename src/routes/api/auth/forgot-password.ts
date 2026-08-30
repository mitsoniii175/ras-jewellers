import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { generateToken, hashToken, normalizeEmail } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { createReset, findUserByEmail } from "@/lib/server/repo";
import { route } from "@/lib/server/session";
import { validateEmail } from "@/lib/validation";

type Body = { email?: string };

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export const Route = createFileRoute("/api/auth/forgot-password")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const body = await readJsonBody<Body>(request);
        const email = normalizeEmail(body?.email ?? "");
        const invalid = validateEmail(email);
        if (invalid) return fail(invalid, 400, "email");

        const user = await findUserByEmail(email);
        let devLink: string | undefined;

        if (user) {
          const token = generateToken();
          await createReset(await hashToken(token), user.id, RESET_TTL_MS);

          const link = new URL(`/account/reset-password?token=${token}`, request.url).toString();

          // TODO(email): no transactional email provider is connected yet, so
          // the link is logged rather than sent. Wire up your provider here
          // (Resend / SendGrid / Netlify Email) and delete the console line.
          console.info(`[ras/account] password reset link for ${email}: ${link}`);

          // Opt-in escape hatch so the flow is testable before email exists.
          // Set RAS_SHOW_RESET_LINK=1 in the Netlify UI ONLY while testing —
          // with it on, anyone can reset any account they know the email of.
          if (typeof process !== "undefined" && process.env?.RAS_SHOW_RESET_LINK === "1") {
            devLink = link;
          }
        }

        // Always the same answer whether or not the account exists, so this
        // endpoint can't be used to discover which customers are registered.
        return json({
          ok: true,
          message: "If an account exists for that email, we've sent password reset instructions.",
          devLink,
        });
      }),
    },
  },
});
