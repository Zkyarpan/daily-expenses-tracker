/**
 * src/lib/profile/schemas.ts
 *
 * Shared contract for the profile backend (src/app/api/profile/**) and the
 * profile page: validation schemas, constants and response types. The limits
 * here mirror the CHECK constraints in
 * supabase/migrations/20261117000000_create_profiles.sql, so the API rejects
 * a value before the database would.
 *
 * Pure module — safe on the server, in the browser and in unit tests.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEMES)[number];

export const AVATAR_SEED_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const INCOME_MAX = 10_000_000;
export const PASSWORD_MIN = 8;
/** bcrypt (used by Supabase Auth) only reads the first 72 bytes. */
export const PASSWORD_MAX = 72;
export const DELETE_CONFIRMATION = "DELETE";

/** Keep in sync with the CHECK constraint on public.account_activity.event. */
export const ACTIVITY_EVENTS = [
  "profile_updated",
  "password_changed",
  "password_change_failed",
  "email_change_requested",
  "signed_out_everywhere",
  "sample_data_loaded",
  "sample_data_removed",
  "data_exported",
] as const;
export type ActivityEventName = (typeof ACTIVITY_EVENTS)[number];

export const ACTIVITY_LABELS: Record<ActivityEventName, string> = {
  data_exported: "Expenses exported",
  email_change_requested: "Email change requested",
  password_change_failed: "Password change failed",
  password_changed: "Password changed",
  profile_updated: "Profile updated",
  sample_data_loaded: "Sample data loaded",
  sample_data_removed: "Sample data removed",
  signed_out_everywhere: "Signed out of all devices",
};

// ─────────────────────────────────────────────────────────────────────────────
// Request schemas (API bodies)
// ─────────────────────────────────────────────────────────────────────────────

export const fullNameSchema = z
  .string()
  .trim()
  .min(NAME_MIN, `Enter at least ${NAME_MIN} characters.`)
  .max(NAME_MAX, `Keep your name under ${NAME_MAX} characters.`);

/** Whole pence only, e.g. 2500 or 2500.5 — never 2500.123. */
const isWholePence = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

export const monthlyIncomeSchema = z
  .number()
  .positive("Income must be more than zero.")
  .lt(INCOME_MAX, "That amount is too large.")
  .refine(isWholePence, "Use at most two decimal places.");

/** PATCH /api/profile — every field optional, unknown keys rejected. */
export const profileUpdateSchema = z
  .strictObject({
    avatarSeed: z.string().regex(AVATAR_SEED_PATTERN, "That avatar is not valid.").nullable().optional(),
    fullName: fullNameSchema.optional(),
    monthlyIncome: monthlyIncomeSchema.nullable().optional(),
    monthlySavingsGoal: monthlyIncomeSchema.nullable().optional(),
    theme: z.enum(THEMES).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "There is nothing to update.");

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;

/** POST /api/profile/password */
export const passwordChangeSchema = z
  .strictObject({
    currentPassword: z.string().min(1, "Enter your current password.").max(200),
    newPassword: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
      .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer.`),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password different from your current one.",
    path: ["newPassword"],
  });

export type PasswordChange = z.infer<typeof passwordChangeSchema>;

/** POST /api/profile/email */
export const emailChangeSchema = z.strictObject({
  email: z.email("Enter a valid email address.").max(254, "That email address is too long."),
});

/** DELETE /api/profile */
export const deleteAccountSchema = z.strictObject({
  confirmation: z.literal(DELETE_CONFIRMATION, `Type ${DELETE_CONFIRMATION} to confirm.`),
  password: z.string().min(1, "Enter your password.").max(200),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Where profile fields are stored: the `profiles` table, or (before the
 * migration is applied) the auth user's metadata.
 */
export type ProfileStorage = "metadata" | "table";

export interface ProfileRecord {
  avatarSeed: string | null;
  fullName: string;
  monthlyIncome: number | null;
  /** How much the user wants to save each month (optional). */
  monthlySavingsGoal: number | null;
  theme: ThemePreference | null;
  updatedAt: string | null;
}

/** Everything the profile page shows about the signed-in account. */
export interface AccountInfo extends Omit<ProfileRecord, "updatedAt"> {
  createdAt: string | null;
  email: string;
  emailConfirmedAt: string | null;
  id: string;
  lastSignInAt: string | null;
  /** Auth provider, e.g. "email" or "google". */
  provider: string;
  storage: ProfileStorage;
}

export interface ProfileStats {
  /** null when the table does not exist in this database. */
  budgets: number | null;
  expenses: number;
  /** YYYY-MM-DD of the earliest expense, or null when there are none. */
  firstExpenseDate: string | null;
  /** "rpc" = profile_stats() SQL function; "fallback" = individual queries. */
  source: "fallback" | "rpc";
  spentThisMonth: number;
  spentThisYear: number;
  trackers: number | null;
}

export interface ActivityEvent {
  createdAt: string;
  detail: string | null;
  device: string | null;
  event: ActivityEventName;
  id: string;
}

export interface ActivityResponse {
  /** false until the account_activity table exists. */
  available: boolean;
  events: ActivityEvent[];
}

export type SampleDataCounts = { budgets: number; expenses: number; ious: number; trackers: number; wishlist: number };
