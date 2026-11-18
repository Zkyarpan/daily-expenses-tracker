/**
 * src/lib/server/http.ts
 *
 * Shared plumbing for every authenticated JSON API route
 * (/api/profile/**, /api/ious/**, /api/wishlist/**, /api/money/**).
 *
 * Security model
 *  - Middleware does NOT check sessions for /api/*, so every handler calls
 *    `authenticate()` first.
 *  - Data is read and written with the caller's cookie session, so RLS
 *    (user_id = auth.uid()) is the real enforcement; queries also filter on
 *    the verified user id as defence in depth.
 *  - State-changing requests must be same-origin JSON with a small body
 *    (blocks cross-site form posts / CSRF) — see `readJsonBody`.
 *  - Responses are never cached (`Cache-Control: no-store`).
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { z } from "zod";

import type { RateLimitDecision } from "@/lib/insights/rateLimit";
import { createServerClient } from "@/utils/supabase/server";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

// ─────────────────────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────────────────────

export const apiJson = <T>(data: T, status = 200) => NextResponse.json(data, { headers: NO_STORE, status });

export const apiError = (
  status: number,
  message: string,
  extra: { field?: string; headers?: Record<string, string>; retryAfterSeconds?: number; setupRequired?: boolean } = {},
) =>
  NextResponse.json(
    {
      error: message,
      field: extra.field,
      retryAfterSeconds: extra.retryAfterSeconds,
      setupRequired: extra.setupRequired,
    },
    { headers: { ...NO_STORE, ...extra.headers }, status },
  );

export const tooManyRequests = (decision: Extract<RateLimitDecision, { allowed: false }>, message: string) =>
  apiError(429, message, {
    headers: { "Retry-After": String(decision.retryAfterSeconds) },
    retryAfterSeconds: decision.retryAfterSeconds,
  });

/** First validation message (and the field it belongs to), for a 400 response. */
export const firstIssue = (error: z.ZodError) => {
  const issue = error.issues[0];
  return {
    field: issue?.path[0] !== undefined ? String(issue.path[0]) : undefined,
    message: issue?.message ?? "Invalid request.",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Authentication and request hardening
// ─────────────────────────────────────────────────────────────────────────────

export type Authenticated = { supabase: SupabaseClient; user: User };

/** The signed-in caller, or an error response to return as-is. */
export async function authenticate(): Promise<Authenticated | { response: NextResponse }> {
  const supabase = await createServerClient();
  if (!supabase) {
    return { response: apiError(503, "This needs a signed-in account (Supabase is not configured).") };
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: apiError(401, "Please sign in again.") };
  return { supabase, user };
}

/**
 * Rejects cross-site requests: when the browser sends an Origin header it
 * must match this host. (Same-origin fetches always match.)
 */
export function rejectCrossSite(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  // Compare with the host the browser actually used (Host / X-Forwarded-Host),
  // not request.url, which Next may rebuild with a different hostname
  // (e.g. "localhost" when the app was opened on 127.0.0.1 or a LAN address).
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")]
    .flatMap((h) => (h ? h.split(",") : []))
    .map((h) => h.trim().toLowerCase());
  try {
    const originHost = new URL(origin).host.toLowerCase();
    if (hosts.includes(originHost) || originHost === new URL(request.url).host.toLowerCase()) return null;
  } catch {
    // fall through
  }
  return apiError(403, "Cross-site requests are not allowed.");
}

/** Same-origin JSON body, size-capped, validated with `schema`. */
export async function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  maxBytes = 2048,
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return { response: crossSite };
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { response: apiError(415, "Requests must be JSON.") };
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return { response: apiError(413, "Request is too large.") };
  }
  const text = await request.text();
  if (text.length > maxBytes) return { response: apiError(413, "Request is too large.") };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { response: apiError(400, "Request body is not valid JSON.") };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const { field, message } = firstIssue(parsed.error);
    return { response: apiError(400, message, { field }) };
  }
  return { data: parsed.data };
}

/** UUID path parameters only — anything else is a 404 before touching the database. */
export const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
