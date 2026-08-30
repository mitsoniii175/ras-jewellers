import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { saveAdmin } from "@/lib/server/admin-repo";
import { findOrBootstrapAdmin, startAdminSession } from "@/lib/server/admin-session";
import { toPublicAdmin } from "@/lib/server/admin-types";
import { hashPassword, normalizeEmail, verifyPassword } from "@/lib/server/crypto";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { route } from "@/lib/server/session";

type Body = { email?: string; password?: string };

// Same decoy-hash trick as the customer login: a missing admin and a wrong
// password must take the same time and give the same answer.
let decoyPromise: Promise<string> | undefined;
function decoy() {
  if (!decoyPromise) decoyPromise = hashPassword("ras-admin-decoy");
  return decoyPromise;
}

// Admin logins are throttled harder than customer logins.
const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = ATTEMPTS.get(key);
  if (!entry || now > entry.resetAt) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export const Route = createFileRoute("/api/admin/login")({
  server: {
    handlers: {
      POST: route(async ({ request }) => {
        const body = await readJsonBody<Body>(request);
        const email = normalizeEmail(body?.email ?? "");
        const password = body?.password ?? "";
        if (!email || !password) return fail("Enter your email and password.");

        if (throttled(email)) {
          return fail("Too many attempts. Please wait 15 minutes.", 429);
        }

        // findOrBootstrapAdmin creates the very first owner from env vars, and
        // only ever when zero admins exist.
        const admin = await findOrBootstrapAdmin(email, password);
        const valid = await verifyPassword(password, admin?.passwordHash ?? (await decoy()));

        if (!admin || !valid || !admin.active) {
          return fail("Incorrect email or password.", 401);
        }

        ATTEMPTS.delete(email);
        await saveAdmin({ ...admin, lastLoginAt: new Date().toISOString() });

        return json(
          { ok: true, admin: toPublicAdmin(admin) },
          { headers: { "set-cookie": await startAdminSession(request, admin.id) } },
        );
      }),
    },
  },
});
