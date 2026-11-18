/**
 * src/lib/plan/schemas.ts
 *
 * Contract for the Savings plan (fixed costs + savings goals), shared by
 * /api/plan/** and the /plan page. Limits mirror the CHECK constraints in
 * supabase/migrations/20261119000000_create_savings_plan.sql.
 */

import { z } from "zod";

import { dateKeySchema, MONEY_MAX, moneySchema, type SetupRequired } from "@/lib/money/schemas";

const isWholePence = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

const name = z.string().trim().min(1, "Enter a name.").max(60, "Keep the name under 60 characters.");

// ─────────────────────────────────────────────────────────────────────────────
// Fixed costs
// ─────────────────────────────────────────────────────────────────────────────

const fixedCostFields = {
  amount: moneySchema,
  dueDay: z.number().int().min(1, "Day 1–31.").max(31, "Day 1–31.").nullable().optional(),
  name,
};

export const fixedCostCreateSchema = z.strictObject(fixedCostFields);
export const fixedCostUpdateSchema = z
  .strictObject({
    amount: fixedCostFields.amount.optional(),
    dueDay: fixedCostFields.dueDay,
    name: name.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "There is nothing to update.");

export type FixedCostCreate = z.infer<typeof fixedCostCreateSchema>;
export type FixedCostUpdate = z.infer<typeof fixedCostUpdateSchema>;

export interface FixedCost {
  amount: number;
  dueDay: number | null;
  id: string;
  name: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings goals
// ─────────────────────────────────────────────────────────────────────────────

export const goalCreateSchema = z.strictObject({
  name,
  savedAmount: z.number().min(0).lt(MONEY_MAX).refine(isWholePence, "Use at most two decimal places.").optional(),
  targetAmount: moneySchema,
  targetDate: dateKeySchema.nullable().optional(),
});

/** edit: change details · contribute: add money (negative takes it out). */
export const goalUpdateSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("edit"),
    name: name.optional(),
    targetAmount: moneySchema.optional(),
    targetDate: dateKeySchema.nullable().optional(),
  }),
  z.strictObject({
    action: z.literal("contribute"),
    amount: z
      .number()
      .refine((v) => v !== 0 && Math.abs(v) < MONEY_MAX, "Enter an amount.")
      .refine(isWholePence, "Use at most two decimal places."),
  }),
]);

export type GoalCreate = z.infer<typeof goalCreateSchema>;
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;

export interface SavingsGoal {
  id: string;
  name: string;
  savedAmount: number;
  targetAmount: number;
  targetDate: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanMonth {
  /** Spending not matched to a fixed cost. */
  everyday: number;
  /** false for the month in progress. */
  complete: boolean;
  /** "Nov 2026" */
  label: string;
  /** YYYY-MM */
  month: string;
  /** income − fixed costs − everyday spending (null without income). */
  saved: number | null;
  /** Everything recorded that month. */
  spent: number;
}

export interface GoalPlan extends SavingsGoal {
  /** Months left to the deadline (≥ 1), or null without one. */
  monthsLeft: number | null;
  /** To put aside each month to hit the deadline (0 when done; null without a deadline). */
  monthlyNeed: number | null;
}

export type PlanStatus = "behind" | "goals-unaffordable" | "no-goals" | "no-income" | "on-track";

export interface PlanSummary {
  /** income − fixed costs. */
  afterFixed: number | null;
  /** Average everyday spending over the last (up to 3) complete months with data. */
  avgEveryday: number | null;
  /** Average saved over the same months. */
  avgSaved: number | null;
  fixedTotal: number;
  goals: GoalPlan[];
  /** Sum of monthly needs for goals with deadlines. */
  goalsMonthly: number;
  income: number | null;
  /** What is left for everyday spending after fixed costs and goal savings. */
  leftToSpend: number | null;
  leftToSpendPerDay: number | null;
  status: PlanStatus;
  /** Starting value for the "what if I save …" slider. */
  suggestedMonthly: number;
  /** Total already saved across goals. */
  totalSaved: number;
}

export type PlanResponse =
  | {
      fixedCosts: FixedCost[];
      goals: SavingsGoal[];
      history: PlanMonth[];
      /** The profile's monthly savings goal (tracked on Home). */
      monthlySavingsGoal: number | null;
      summary: PlanSummary;
    }
  | SetupRequired;
