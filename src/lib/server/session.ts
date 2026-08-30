// Session lifecycle. A session token is a 256-bit random string handed to the
// browser in an HttpOnly cookie; only its SHA-256 digest is stored server-side.

import { generateToken, hashToken } from "./crypto";
import { readCookie, SESSION_COOKIE, sessionCookie } from "./http";
import { createSession, destroySession, findUserById, readSession } from "./repo";
import type { StoredUser } from "./types";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;

export async function startSession(request: Request, userId: string): Promise<string> {
  const token = generateToken();
  await createSession(await hashToken(token), userId, SESSION_TTL_MS);
  return sessionCookie(request, token, SESSION_TTL_SECONDS);
}

export async function endSession(request: Request): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return;
  await destroySession(await hashToken(token));
}

/**
 * Resolves the signed-in customer from the request cookie.
 * This is the ONLY way an API route learns whose data it's allowed to touch —
 * no route ever accepts a userId from the request body or query string.
 */
export async function currentUser(request: Request): Promise<StoredUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await readSession(await hashToken(token));
  if (!session) return null;
  return findUserById(session.userId);
}

/** Throws a 401 Response when there's no valid session. */
export async function requireUser(request: Request): Promise<StoredUser> {
  const user = await currentUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ ok: false, error: "Please log in to continue." }), {
      status: 401,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "private, no-store",
      },
    });
  }
  return user;
}

/** Wraps a handler so a thrown Response (e.g. from requireUser) is returned. */
export function route(handler: (ctx: { request: Request }) => Promise<Response>) {
  return async (ctx: { request: Request }): Promise<Response> => {
    try {
      return await handler(ctx);
    } catch (error) {
      if (error instanceof Response) return error;
      console.error("[ras/account] unhandled API error", error);
      return new Response(
        JSON.stringify({ ok: false, error: "Something went wrong. Please try again." }),
        {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    }
  };
}
