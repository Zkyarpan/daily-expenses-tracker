/**
 * src/lib/profile/server.ts
 *
 * Server-only helpers shared by the /api/profile route handlers, the profile
 * page and the protected layout. The request security model is documented
 * in src/lib/server/http.ts.
 */

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { apiError } from "@/lib/server/http";
import { isMissingTableError } from "@/lib/supabase/queries";
import { getSupabaseConfig } from "@/utils/supabase/config";

import { deviceLabel } from "./format";
import {
  type AccountInfo,
  type ActivityEventName,
  AVATAR_SEED_PATTERN,
  NAME_MAX,
  NAME_MIN,
  type ProfileRecord,
  type ProfileStorage,
  type ProfileUpdate,
  type ThemePreference,
  THEMES,
} from "./schemas";

// Generic request plumbing now lives in src/lib/server/http.ts; re-exported
// so existing imports keep working.
export {
  apiError,
  apiJson,
  authenticate,
  NO_STORE,
  readJsonBody,
  rejectCrossSite,
  tooManyRequests,
} from "@/lib/server/http";

// ─────────────────────────────────────────────────────────────────────────────
// Profile record
// ─────────────────────────────────────────────────────────────────────────────

/** "*" so a database without the newer optional columns still reads fine. */
const PROFILE_COLUMNS = "*";

const cleanName = (value: unknown) => {
  if (typeof value !== "string") return "";
  const name = value.trim();
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : "";
};
const cleanSeed = (value: unknown) =>
  typeof value === "string" && AVATAR_SEED_PATTERN.test(value) ? value : null;
const cleanIncome = (value: unknown) => {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
const cleanTheme = (value: unknown): ThemePreference | null =>
  THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : null;

/** Profile fields kept in auth user_metadata (before the profiles table existed). */
export const profileFromMetadata = (user: User): ProfileRecord => ({
  avatarSeed: cleanSeed(user.user_metadata?.avatar_seed),
  fullName: cleanName(user.user_metadata?.full_name),
  monthlyIncome: cleanIncome(user.user_metadata?.monthly_income),
  monthlySavingsGoal: cleanIncome(user.user_metadata?.monthly_savings_goal),
  theme: cleanTheme(user.user_metadata?.theme),
  updatedAt: null,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profileFromRow = (row: any): ProfileRecord => ({
  avatarSeed: cleanSeed(row.avatarSeed),
  fullName: cleanName(row.fullName),
  monthlyIncome: cleanIncome(row.monthlyIncome),
  monthlySavingsGoal: cleanIncome(row.monthlySavingsGoal),
  theme: cleanTheme(row.theme),
  updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
});

/**
 * Reads the caller's profile from `profiles`, creating the row if the
 * sign-up trigger missed it. Falls back to user_metadata when the table has
 * not been created yet (migration not applied).
 */
export async function readProfile(
  supabase: SupabaseClient,
  user: User,
): Promise<{ profile: ProfileRecord; storage: ProfileStorage }> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) console.warn("[profile] read failed:", error.code);
    return { profile: profileFromMetadata(user), storage: "metadata" };
  }
  if (data) return { profile: profileFromRow(data), storage: "table" };

  // No row yet: seed it from metadata so nothing the user set is lost.
  const seeded = profileFromMetadata(user);
  const { data: created } = await supabase
    .from("profiles")
    .upsert(
      {
        avatarSeed: seeded.avatarSeed,
        fullName: seeded.fullName || null,
        id: user.id,
        monthlyIncome: seeded.monthlyIncome,
      },
      { ignoreDuplicates: true, onConflict: "id" },
    )
    .select(PROFILE_COLUMNS)
    .maybeSingle();
  return { profile: created ? profileFromRow(created) : seeded, storage: "table" };
}

export type ProfileSaveResult =
  | { ok: true; storage: ProfileStorage }
  | { message: string; ok: false; setupRequired?: boolean; status: number };

/**
 * Writes profile fields to the profiles table (upsert on the primary key, so
 * only the given fields change), or to auth user_metadata until the profiles
 * migration is applied. Shared by PATCH /api/profile and POST /api/onboarding.
 */
export async function saveProfile(
  supabase: SupabaseClient,
  user: User,
  patch: ProfileUpdate,
): Promise<ProfileSaveResult> {
  const { storage } = await readProfile(supabase, user);

  if (storage === "table") {
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...patch }, { onConflict: "id" });
    if (!error) return { ok: true, storage };
    // PGRST204: a column (e.g. monthlySavingsGoal) is missing — newer migration not applied.
    if (error.code === "PGRST204") {
      return {
        message: "Saving this needs the latest database setup. Open Lend & borrow or Wishlist to finish setup.",
        ok: false,
        setupRequired: true,
        status: 409,
      };
    }
    console.warn("[profile] update failed:", error.code);
    return {
      message: "Your profile could not be saved. Please try again.",
      ok: false,
      status: error.code === "23514" ? 400 : 500,
    };
  }

  const data: Record<string, unknown> = {};
  if (patch.fullName !== undefined) data.full_name = patch.fullName;
  if (patch.avatarSeed !== undefined) data.avatar_seed = patch.avatarSeed;
  if (patch.monthlyIncome !== undefined) data.monthly_income = patch.monthlyIncome;
  if (patch.monthlySavingsGoal !== undefined) data.monthly_savings_goal = patch.monthlySavingsGoal;
  if (patch.theme !== undefined) data.theme = patch.theme;
  const { error } = await supabase.auth.updateUser({ data });
  return error ? { message: "Your profile could not be saved. Please try again.", ok: false, status: 500 } : { ok: true, storage };
}

/** Account summary for the profile page. */
export const accountSummary = (user: User, profile: ProfileRecord, storage: ProfileStorage): AccountInfo => ({
  avatarSeed: profile.avatarSeed,
  createdAt: user.created_at ?? null,
  email: user.email ?? "",
  emailConfirmedAt: user.email_confirmed_at ?? null,
  fullName: profile.fullName,
  id: user.id,
  lastSignInAt: user.last_sign_in_at ?? null,
  monthlyIncome: profile.monthlyIncome,
  monthlySavingsGoal: profile.monthlySavingsGoal,
  provider: typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "email",
  storage,
  theme: profile.theme,
});

// ─────────────────────────────────────────────────────────────────────────────
// Activity log
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends an event to account_activity. Best effort: a missing table or a
 * failed insert never fails the user's action.
 */
export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  event: ActivityEventName,
  { detail, request }: { detail?: string; request?: Request } = {},
) {
  const { error } = await supabase.from("account_activity").insert({
    detail: detail ? detail.slice(0, 200) : null,
    device: deviceLabel(request?.headers.get("user-agent"))?.slice(0, 80) ?? null,
    event,
    user_id: userId,
  });
  if (error && !isMissingTableError(error)) console.warn("[profile] activity not logged:", error.code);
}

// ─────────────────────────────────────────────────────────────────────────────
// Password verification
// ─────────────────────────────────────────────────────────────────────────────

export type PasswordCheck = "invalid" | "ok" | "rate_limited" | "unavailable";

/**
 * Checks the caller's password with a throwaway, non-persisting client, so
 * the request's own session cookies are untouched; the temporary session is
 * revoked straight away.
 */
export async function verifyPassword(email: string, password: string): Promise<PasswordCheck> {
  const { supabaseKey, supabaseUrl } = getSupabaseConfig();
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return "rate_limited";
    if (error.status === 400 || error.code === "invalid_credentials") return "invalid";
    console.warn("[profile] password check failed:", error.status, error.code);
    return "unavailable";
  }
  await client.auth.signOut({ scope: "local" }).catch(() => undefined);
  return "ok";
}

export const passwordCheckError = (result: Exclude<PasswordCheck, "ok">, field = "currentPassword") =>
  result === "invalid"
    ? apiError(400, "That password is not correct.", { field })
    : result === "rate_limited"
      ? apiError(429, "Too many attempts. Please wait a few minutes and try again.")
      : apiError(503, "Your password could not be checked right now. Please try again.");
