// Password hashing + token helpers.
//
// Everything here runs on the SERVER ONLY (imported from src/routes/api/**).
// We use the Web Crypto API rather than node:crypto so the same code works on
// Netlify Functions, Netlify Edge and plain Node during `vite dev`.
//
// Passwords are never stored. What we persist is a PBKDF2-SHA256 digest with a
// per-user random salt, in a self-describing format so the iteration count can
// be raised later without invalidating existing accounts.

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEYLEN_BITS = 256;
const SALT_BYTES = 16;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN_BITS,
  );
  return toHex(bits);
}

/** Returns a string of the form `pbkdf2$<iterations>$<saltHex>$<hashHex>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${hash}`;
}

/**
 * Constant-time-ish comparison of a candidate password against a stored digest.
 * Returns false (never throws) for malformed or missing digests.
 */
export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  try {
    const candidate = await pbkdf2(password, fromHex(parts[2]), iterations);
    return timingSafeEqual(candidate, parts[3]);
  } catch {
    return false;
  }
}

/** Length-independent, branch-free string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** A 256-bit URL-safe random token — used for sessions and password resets. */
export function generateToken(): string {
  return toHex(randomBytes(32));
}

/**
 * Session and reset tokens are stored HASHED, exactly like passwords, so a
 * leaked datastore can't be replayed as a set of live logins.
 */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

/** Stable, non-reversible key for the email -> userId lookup index. */
export async function emailKey(email: string): Promise<string> {
  return `email:${await hashToken(normalizeEmail(email))}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function newId(prefix: string): string {
  return `${prefix}_${toHex(randomBytes(12))}`;
}
