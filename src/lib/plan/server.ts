/**
 * src/lib/plan/server.ts
 *
 * Server-only data access for the Savings plan, used by /api/plan/** and the
 * assistant. Queries run with the caller's session (RLS) and filter on their
 * user id.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isSetupError } from "@/lib/money/server";
import { readProfile } from "@/lib/profile/server";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

import { buildPlan, monthlyHistory, recentMonths } from "./calc";
import type { FixedCost, PlanResponse, SavingsGoal } from "./schemas";

const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fixedCostFromRow = (row: any): FixedCost => ({
  amount: num(row.amount),
  dueDay: row.dueDay === null || row.dueDay === undefined ? null : Number(row.dueDay),
  id: String(row.id),
  name: String(row.name ?? ""),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const goalFromRow = (row: any): SavingsGoal => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  savedAmount: num(row.savedAmount),
  targetAmount: num(row.targetAmount),
  targetDate: typeof row.targetDate === "string" ? row.targetDate.slice(0, 10) : null,
});

/** Six complete months plus the current one. */
export const HISTORY_MONTHS = 7;

export async function loadPlan(supabase: SupabaseClient, user: User, today: string): Promise<PlanResponse> {
  const months = recentMonths(today, HISTORY_MONTHS);
  const [{ profile }, fixed, goals, expenses] = await Promise.all([
    readProfile(supabase, user),
    supabase.from("fixed_costs").select("*").eq("user_id", user.id).order("amount", { ascending: false }),
    supabase.from("savings_goals").select("*").eq("user_id", user.id).order("createdAt", { ascending: true }),
    fetchExpenseRowsBetween(supabase, user.id, `${months[0]}-01`, today, "amount,date,description"),
  ]);

  if (fixed.error || goals.error) {
    if (isSetupError(fixed.error) || isSetupError(goals.error)) return { setupRequired: true };
    throw fixed.error ?? goals.error;
  }

  const fixedCosts = (fixed.data ?? []).map(fixedCostFromRow);
  const savingsGoals = (goals.data ?? []).map(goalFromRow);
  const history = monthlyHistory({
    expenses: expenses.map((e) => ({ amount: Number(e.amount), date: String(e.date), description: e.description ?? null })),
    fixedCosts,
    income: profile.monthlyIncome,
    months,
    today,
  });

  return {
    fixedCosts,
    goals: savingsGoals,
    history,
    monthlySavingsGoal: profile.monthlySavingsGoal,
    summary: buildPlan({ fixedCosts, goals: savingsGoals, history, income: profile.monthlyIncome, today }),
  };
}
