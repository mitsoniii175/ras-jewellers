// Admin authentication.
//
// Deliberately a parallel system to the customer session, not an extension of
// it:
//   - its own cookie name (ras_admin), so a customer session can never be
//     mistaken for an admin one;
//   - its own store, so no request a customer can make touches an admin record;
//   - Path=/ but checked on every admin route server-side.
//
// A customer cannot escalate to admin by any means available to the browser.

import { generateToken, hashPassword, hashToken, timingSafeEqual } from "./crypto";
import { readCookie } from "./http";
import { countAdmins, createAdmin, findAdminByEmail, findAdminById } from "./admin-repo";
import { can, type Permission, type StoredAdmin } from "./admin-types";
import { kvDel, kvGet, kvSet } from "./kv";

export const ADMIN_COOKIE = "ras_admin";

// Deliberately shorter than the 30-day customer session: an admin session is
// far more dangerous if it leaks.
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const ADMIN_TTL_SECONDS = ADMIN_TTL_MS / 1000;

const adminSessionKey = (tokenHash: string) => `adminsession:${tokenHash}`;

type AdminSessionRecord = { adminId: string; createdAt: string; expiresAt: number };

function isSecureRequest(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

function cookie(request: Request, token: string, maxAgeSeconds: number): string {
  const attrs = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    // Strict (not Lax): an admin action should never be triggered by following
    // a link from another site.
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(request)) attrs.push("Secure");
  return attrs.join("; ");
}

export async function startAdminSession(request: Request, adminId: string): Promise<string> {
  const token = generateToken();
  await kvSet<AdminSessionRecord>(adminSessionKey(await hashToken(token)), {
    adminId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + ADMIN_TTL_MS,
  });
  return cookie(request, token, ADMIN_TTL_SECONDS);
}

export async function endAdminSession(request: Request): Promise<void> {
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return;
  await kvDel(adminSessionKey(await hashToken(token)));
}

export function clearedAdminCookie(request: Request): string {
  return cookie(request, "", 0);
}

/** Resolves the signed-in admin from the admin cookie, or null. */
export async function currentAdmin(request: Request): Promise<StoredAdmin | null> {
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) return null;

  const key = adminSessionKey(await hashToken(token));
  const session = await kvGet<AdminSessionRecord>(key);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    await kvDel(key);
    return null;
  }

  const admin = await findAdminById(session.adminId);
  // A deactivated admin loses access immediately, without waiting for the
  // session to expire.
  if (!admin?.active) return null;
  return admin;
}

function deny(status: number, error: string): Response {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
    },
  });
}

/**
 * The gate every admin API route goes through.
 *
 * Throws a Response (caught by `route()`) when the caller is not a signed-in
 * admin with the required permission. Permission is resolved from the STORED
 * role — never from anything in the request.
 */
export async function requireAdmin(
  request: Request,
  permission?: Permission,
): Promise<StoredAdmin> {
  const admin = await currentAdmin(request);
  if (!admin) throw deny(401, "Please log in to the admin area.");

  if (permission && !can(admin.role, permission)) {
    console.warn(`[ras/admin] ${admin.email} (${admin.role}) denied ${permission}`);
    throw deny(403, "You do not have permission to do that.");
  }

  return admin;
}

/* ------------------------------------------------------------- bootstrap -- */

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function adminBootstrapConfigured(): boolean {
  return Boolean(env("ADMIN_BOOTSTRAP_EMAIL") && env("ADMIN_BOOTSTRAP_PASSWORD"));
}

/**
 * Creates the very first owner account from environment variables.
 *
 * Only ever fires when there are ZERO admins, so it cannot be used to add an
 * account later or to overwrite an existing one. After the first login, remove
 * the two env vars — further admins are created from inside the dashboard.
 */
export async function bootstrapFirstAdmin(
  email: string,
  password: string,
): Promise<StoredAdmin | null> {
  if (await countAdmins()) return null;

  const bootstrapEmail = env("ADMIN_BOOTSTRAP_EMAIL");
  const bootstrapPassword = env("ADMIN_BOOTSTRAP_PASSWORD");
  if (!bootstrapEmail || !bootstrapPassword) return null;

  // Constant-time compare on both halves.
  const emailMatches = timingSafeEqual(
    email.trim().toLowerCase(),
    bootstrapEmail.trim().toLowerCase(),
  );
  const passwordMatches = timingSafeEqual(password, bootstrapPassword);
  if (!emailMatches || !passwordMatches) return null;

  // Guard against a weak bootstrap password becoming a permanent owner login.
  if (bootstrapPassword.length < 12) {
    console.error("[ras/admin] ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
    return null;
  }

  console.info("[ras/admin] bootstrapping the first owner account for", bootstrapEmail);
  return createAdmin({
    name: "Owner",
    email: bootstrapEmail,
    passwordHash: await hashPassword(bootstrapPassword),
    role: "owner",
  });
}

/** Convenience for the login route: bootstrap if needed, then look up. */
export async function findOrBootstrapAdmin(
  email: string,
  password: string,
): Promise<StoredAdmin | null> {
  const bootstrapped = await bootstrapFirstAdmin(email, password);
  if (bootstrapped) return bootstrapped;
  return findAdminByEmail(email);
}
