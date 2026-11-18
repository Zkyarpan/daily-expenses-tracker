/**
 * src/lib/api/client.ts
 *
 * Minimal JSON fetch wrapper for the app's own API routes. Errors become
 * `ApiError`s carrying the HTTP status, the field to highlight, the wait
 * time for 429s, and whether a one-time database setup is needed.
 */

export class ApiError extends Error {
  readonly field?: string;
  readonly retryAfterSeconds?: number;
  readonly setupRequired: boolean;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    body: { field?: string; retryAfterSeconds?: number; setupRequired?: boolean } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.field = body.field;
    this.retryAfterSeconds = body.retryAfterSeconds;
    this.setupRequired = !!body.setupRequired;
  }
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error ?? "Something went wrong. Please try again.", response.status, body);
  }
  return body as T;
}

export const json = (method: string, data?: unknown): RequestInit => ({
  body: data === undefined ? undefined : JSON.stringify(data),
  method,
});

/** User-facing message for any error thrown by the API clients. */
export const apiErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    return error.status === 429 && error.retryAfterSeconds
      ? `${error.message} (try again in ${error.retryAfterSeconds}s)`
      : error.message;
  }
  return "Something went wrong. Please check your connection and try again.";
};
