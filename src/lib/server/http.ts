// Small request/response helpers shared by every /api/** route handler.

export const SESSION_COOKIE = "ras_session";

export function json(data: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Account data is per-customer and must never be cached by a CDN.
      "cache-control": "private, no-store",
      ...init?.headers,
    },
  });
}

export function fail(message: string, status = 400, field?: string) {
  return json({ ok: false, error: message, field }, { status });
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function isSecureRequest(request: Request): boolean {
  // Netlify terminates TLS upstream, so trust the forwarded proto first.
  const proto = request.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(request.url).protocol === "https:";
}

export function sessionCookie(request: Request, token: string, maxAgeSeconds: number): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly", // not readable from JavaScript -> XSS can't steal the session
    "SameSite=Lax", // blocks cross-site POST/CSRF while keeping normal navigation
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecureRequest(request)) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearedSessionCookie(request: Request): string {
  return sessionCookie(request, "", 0);
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
