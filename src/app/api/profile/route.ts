/**
 * /api/profile — the signed-in user's profile.
 *
 *   GET     → { account, profile, storage }
 *   PATCH   → update name / avatar / monthly income / theme  → { profile }
 *   DELETE  → permanently delete the account and all its data
 *
 * See src/lib/profile/server.ts for the shared security model.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { deleteAccountSchema, profileUpdateSchema } from "@/lib/profile/schemas";
import {
  accountSummary,
  apiError,
  apiJson,
  authenticate,
  logActivity,
  passwordCheckError,
  readJsonBody,
  readProfile,
  saveProfile,
  tooManyRequests,
  verifyPassword,
} from "@/lib/profile/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Profile saves: generous, but stops runaway loops. */
const updateLimiter = createRateLimiter({ limit: 60, minIntervalMs: 200, windowMs: 10 * 60_000 });
/** Account deletion re-checks the password, so it is limited like a sign-in. */
const deleteLimiter = createRateLimiter({ limit: 5, minIntervalMs: 3_000, windowMs: 60 * 60_000 });

const FIELD_LABELS = {
  avatarSeed: "picture",
  fullName: "name",
  monthlyIncome: "monthly income",
  monthlySavingsGoal: "savings goal",
  theme: "theme",
} as const;

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { profile, storage } = await readProfile(auth.supabase, auth.user);
  return apiJson({ account: accountSummary(auth.user, profile, storage), profile, storage });
}

export async function PATCH(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = updateLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You're saving too quickly. Please wait a moment.");

  const body = await readJsonBody(request, profileUpdateSchema);
  if ("response" in body) return body.response;
  const patch = body.data;

  const saved = await saveProfile(supabase, user, patch);
  if (!saved.ok) return apiError(saved.status, saved.message, { setupRequired: saved.setupRequired });
  const { storage } = saved;

  // Theme switches happen often and are not security-relevant.
  const changed = (Object.keys(patch) as (keyof typeof FIELD_LABELS)[]).filter((k) => k !== "theme");
  if (changed.length > 0) {
    await logActivity(supabase, user.id, "profile_updated", {
      detail: `Changed ${changed.map((k) => FIELD_LABELS[k]).join(", ")}`,
      request,
    });
  }

  // Re-read so the client gets exactly what is stored (incl. metadata refresh).
  const {
    data: { user: fresh },
  } = await supabase.auth.getUser();
  const { profile } = await readProfile(supabase, fresh ?? user);
  return apiJson({ profile, storage });
}

export async function DELETE(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = deleteLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Too many attempts. Please wait before trying again.");

  const body = await readJsonBody(request, deleteAccountSchema);
  if ("response" in body) return body.response;

  if (!user.email) return apiError(400, "This account has no password to confirm with.");
  const check = await verifyPassword(user.email, body.data.password);
  if (check !== "ok") return passwordCheckError(check, "password");

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    // PGRST202 / 42883: the function does not exist (migration not applied).
    if (error.code === "PGRST202" || error.code === "42883") {
      return apiError(501, "Account deletion is not enabled on this database yet. Apply the profiles migration first.");
    }
    console.error("[profile] delete failed:", error.code);
    return apiError(500, "Your account could not be deleted. Nothing was removed — please try again.");
  }

  // The auth user is gone; clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  return apiJson({ deleted: true });
}
