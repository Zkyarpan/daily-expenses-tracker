/**
 * src/lib/onboarding/schemas.ts
 *
 * The first-run setup ("onboarding") contract: what the questionnaire asks,
 * the quick-pick presets it offers, and how POST /api/onboarding validates
 * the answers. Pure module.
 */

import { z } from "zod";

import { dateKeySchema, moneySchema } from "@/lib/money/schemas";
import { fullNameSchema } from "@/lib/profile/schemas";

/** What the user wants from the app — used to order tips and the checklist. */
export const INTERESTS = [
  { description: "See where every pound goes", id: "track", label: "Track daily spending" },
  { description: "Stay under monthly limits", id: "budget", label: "Stick to budgets" },
  { description: "Build savings for my goals", id: "save", label: "Save more each month" },
  { description: "Know who owes who", id: "owe", label: "Track money I lend & borrow" },
  { description: "Plan for things I want", id: "wishlist", label: "Save up for purchases" },
  { description: "Spot patterns over time", id: "insights", label: "Understand my habits" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];
const INTEREST_IDS = INTERESTS.map((i) => i.id) as [InterestId, ...InterestId[]];

/** One-tap fixed costs (amounts are typed by the user). */
export const FIXED_COST_PRESETS = [
  "Rent",
  "Council tax",
  "Phone",
  "Broadband",
  "Energy",
  "Travel card",
  "Gym membership",
  "Streaming",
  "Car insurance",
] as const;

export const GOAL_PRESETS = [
  { name: "Emergency fund", target: 3000 },
  { name: "Holiday", target: 800 },
  { name: "House deposit", target: 10000 },
  { name: "New phone", target: 600 },
  { name: "Car", target: 4000 },
  { name: "Wedding", target: 8000 },
] as const;

/** POST /api/onboarding — the answers. Only the name is required. */
export const onboardingSchema = z.strictObject({
  fixedCosts: z
    .array(z.strictObject({ amount: moneySchema, name: z.string().trim().min(1).max(60) }))
    .max(12, "Add up to 12 fixed costs here — you can add more later."),
  fullName: fullNameSchema,
  goal: z
    .strictObject({
      name: z.string().trim().min(1).max(60),
      targetAmount: moneySchema,
      targetDate: dateKeySchema.nullable(),
    })
    .nullable(),
  interests: z.array(z.enum(INTEREST_IDS)).max(INTEREST_IDS.length),
  loadSampleData: z.boolean(),
  monthlyIncome: moneySchema.nullable(),
  monthlySavingsGoal: moneySchema.nullable(),
});

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;

/** Stored in the user's auth metadata (kept tiny: it travels in the session token). */
export interface OnboardingState {
  completedAt?: string;
  interests?: InterestId[];
  skippedAt?: string;
}

export const needsOnboarding = (state: unknown) => {
  const s = (state ?? {}) as OnboardingState;
  return !s.completedAt && !s.skippedAt;
};

export const readInterests = (state: unknown): InterestId[] => {
  const list = (state as OnboardingState | undefined)?.interests;
  return Array.isArray(list) ? list.filter((i): i is InterestId => (INTEREST_IDS as string[]).includes(i)) : [];
};

/** Live summary shown while answering: what is left after fixed costs and saving. */
export function setupSummary({
  fixedCosts,
  income,
  saving,
  today,
}: {
  fixedCosts: readonly { amount: number }[];
  income: number | null;
  saving: number | null;
  today: string;
}) {
  const pence = (v: number) => Math.round(v * 100);
  const fixed = fixedCosts.reduce((s, f) => s + pence(f.amount), 0);
  if (income === null) return { fixed: fixed / 100, left: null, perDay: null };
  const left = pence(income) - fixed - pence(saving ?? 0);
  const [y, m] = today.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { fixed: fixed / 100, left: left / 100, perDay: Math.floor(Math.max(0, left) / days) / 100 };
}

/** Monthly amount to reach a target by a date (at least 1 month), rounded up to the pound. */
export function monthlyForGoal(target: number, targetDate: string | null, today: string): number | null {
  if (!targetDate) return null;
  const [y, m] = today.split("-").map(Number);
  const [ty, tm] = targetDate.split("-").map(Number);
  const months = Math.max(1, (ty - y) * 12 + (tm - m));
  return Math.ceil(target / months);
}
