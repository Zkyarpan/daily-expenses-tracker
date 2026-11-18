/**
 * POST /api/profile/email — request an email address change.
 *
 * Supabase Auth emails a confirmation link (to the new address, and to the
 * old one too when "secure email change" is on). Nothing changes until the
 * link is followed; it returns through /auth/callback to /profile.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { maskEmail } from "@/lib/profile/format";
import { emailChangeSchema } from "@/lib/profile/schemas";
import { apiError, apiJson, authenticate, logActivity, readJsonBody, tooManyRequests } from "@/lib/profile/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Confirmation emails: 3 per hour, 30 s apart. */
const limiter = createRateLimiter({ limit: 3, minIntervalMs: 30_000, windowMs: 60 * 60_000 });

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const body = await readJsonBody(request, emailChangeSchema);
  if ("response" in body) return body.response;
  const email = body.data.email.trim().toLowerCase();

  if (email === user.email?.toLowerCase()) {
    return apiError(400, "This is already your email address.", { field: "email" });
  }

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait before requesting another confirmation email.");

  const origin = new URL(request.url).origin;
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${origin}/auth/callback?next=/profile` },
  );
  if (error) return apiError(error.status === 429 ? 429 : 400, error.message, { field: "email" });

  await logActivity(supabase, user.id, "email_change_requested", { detail: `To ${maskEmail(email)}`, request });
  return apiJson({ sentTo: email });
}
