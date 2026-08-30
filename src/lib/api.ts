// Thin fetch wrapper for the /api/** account endpoints.
// `credentials: "same-origin"` matters: the session lives in an HttpOnly
// cookie, so it only travels if we ask fetch to include it.

export type ApiError = { message: string; field?: string; status: number };

/** The common envelope every /api/** route replies with, plus its own fields. */
type ApiEnvelope = { ok?: boolean; error?: string; field?: string } & Record<string, unknown>;

export class AccountApiError extends Error {
  field?: string;
  status: number;

  constructor({ message, field, status }: ApiError) {
    super(message);
    this.name = "AccountApiError";
    this.field = field;
    this.status = status;
  }
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      signal: options.signal,
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new AccountApiError({
      message: "Can't reach the server. Check your connection.",
      status: 0,
    });
  }

  let payload: ApiEnvelope | null = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response (e.g. an HTML error page) — fall through to the
    // generic message below.
  }

  if (!response.ok || payload?.ok === false) {
    throw new AccountApiError({
      message: payload?.error ?? "Something went wrong. Please try again.",
      field: payload?.field,
      status: response.status,
    });
  }

  return payload as T;
}
