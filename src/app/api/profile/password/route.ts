/**
 * POST /api/profile/password — change the password.
 *
 * The current password is verified first (with a throwaway client, so the
 * session cookies are untouched), failures are logged to the activity
 * history, and attempts are rate limited per user.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { passwordChangeSchema } from "@/lib/profile/schemas";
import {
  apiError,
  apiJson,
  authenticate,
  logActivity,
  passwordCheckError,
  readJsonBody,
  tooManyRequests,
  verifyPassword,
} from "@/lib/profile/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 5 attempts per 15 minutes, at least 3 s apart. */
const limiter = createRateLimiter({ limit: 5, minIntervalMs: 3_000, windowMs: 15 * 60_000 });

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) {
    return tooManyRequests(decision, "Too many password attempts. Please wait a few minutes and try again.");
  }

  const body = await readJsonBody(request, passwordChangeSchema);
  if ("response" in body) return body.response;

  if (!user.email) return apiError(400, "This account signs in without a password.");

  const check = await verifyPassword(user.email, body.data.currentPassword);
  if (check !== "ok") {
    if (check === "invalid") {
      await logActivity(supabase, user.id, "password_change_failed", { detail: "Wrong current password", request });
    }
    return passwordCheckError(check);
  }

  const { error } = await supabase.auth.updateUser({ password: body.data.newPassword });
  if (error) {
    // e.g. "New password should be different from the old password",
    // or a project password policy — safe, user-facing messages.
    return apiError(400, error.message, { field: "newPassword" });
  }

  await logActivity(supabase, user.id, "password_changed", { request });
  return apiJson({ ok: true });
}
