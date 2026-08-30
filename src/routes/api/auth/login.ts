import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { findUserByEmail } from "@/lib/server/repo";
import { route, startSession } from "@/lib/server/session";
import { toPublicCustomer } from "@/lib/server/types";

type Body = { email?: string; password?: string };

// A dummy digest to verify against when the email doesn't exist, so a missing
// account and a wrong password take the same amount of time to answer.
let decoyHashPromise: Promise<string> | undefined;
function decoyHash() {
  if (!decoyHashPromise) decoyHashPromise = hashPassword("ras-jewellers-decoy-password");
  return decoyHashPromise;
}

// Very small in-process throttle. It resets on cold start, so it slows down
// casual guessing rather than a determined distributed attack — put a WAF or
// Netlify rate limiting in front for that.
const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function throttle(key: string): boolean {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry || now > entry.resetAt) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const body = await readJsonBody<Body>(request);
        if (!body) return fail("Invalid request.");

        const email = normalizeEmail(body.email ?? "");
        const password = body.password ?? "";
        if (!email || !password) return fail("Enter your email and password.");

        if (throttle(email)) {
          return fail("Too many attempts. Please wait a few minutes and try again.", 429);
        }

        const user = await findUserByEmail(email);
        const valid = await verifyPassword(password, user?.passwordHash ?? (await decoyHash()));

        // Deliberately identical message for both failure modes — telling the
        // visitor which half was wrong confirms whether an account exists.
        if (!user || !valid) return fail("Incorrect email or password.", 401);

        ATTEMPTS.delete(email);

        return json(
          { ok: true, customer: toPublicCustomer(user) },
          { headers: { "set-cookie": await startSession(request, user.id) } },
        );
      }),
    },
  },
});
