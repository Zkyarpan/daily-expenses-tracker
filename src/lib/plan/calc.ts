/**
 * src/lib/plan/calc.ts
 *
 * Pure maths for the Savings plan, in integer pence:
 *  - monthly history: everyday spending and what was saved each month
 *  - the plan: salary → fixed costs → goal savings → left to spend
 *  - a long-term projection for "what if I save £X a month"
 *
 * Fixed costs (rent…) may or may not also be recorded as expenses. An
 * expense whose description contains a fixed cost's name (e.g. "Rent –
 * November" for "Rent") is treated as that fixed cost, never as everyday
 * spending, so it is not counted twice.
 */

import type { FixedCost, GoalPlan, PlanMonth, PlanStatus, PlanSummary, SavingsGoal } from "./schemas";

const toPence = (v: number) => Math.round(v * 100);
const fromPence = (p: number) => p / 100;

const MONTH_LABEL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthKey = (year: number, month0: number) => `${year}-${String(month0 + 1).padStart(2, "0")}`;
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_LABEL[m - 1]} ${y}`;
};

/** YYYY-MM keys for the `count` months ending with the month of `today` (oldest first). */
export function recentMonths(today: string, count: number): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
    return monthKey(d.getUTCFullYear(), d.getUTCMonth());
  });
}

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;

/**
 * Does this expense description pay one of the fixed costs? Whole words only,
 * so "Rent – November" matches "Rent" but "Parent's gift" does not.
 */
export const matchesFixedCost = (description: string | null | undefined, fixedCosts: readonly FixedCost[]) => {
  const text = words(description ?? "");
  return (
    text.trim().length > 0 &&
    fixedCosts.some((f) => {
      const name = words(f.name);
      return name.trim().length >= 3 && text.includes(name);
    })
  );
};

export type HistoryExpense = { amount: number; date: string; description: string | null };

/**
 * Per-month spending and savings for `months` (YYYY-MM keys). The month of
 * `today` is marked incomplete.
 */
export function monthlyHistory({
  expenses,
  fixedCosts,
  income,
  months,
  today,
}: {
  expenses: readonly HistoryExpense[];
  fixedCosts: readonly FixedCost[];
  income: number | null;
  months: readonly string[];
  today: string;
}): PlanMonth[] {
  const fixedPence = fixedCosts.reduce((s, f) => s + toPence(f.amount), 0);
  const spent = new Map<string, number>();
  const everyday = new Map<string, number>();
  for (const e of expenses) {
    const key = e.date.slice(0, 7);
    const pence = toPence(e.amount);
    spent.set(key, (spent.get(key) ?? 0) + pence);
    if (!matchesFixedCost(e.description, fixedCosts)) everyday.set(key, (everyday.get(key) ?? 0) + pence);
  }
  const current = today.slice(0, 7);
  return months.map((month) => {
    const everydayPence = everyday.get(month) ?? 0;
    return {
      complete: month < current,
      everyday: fromPence(everydayPence),
      label: monthLabel(month),
      month,
      saved: income === null ? null : fromPence(toPence(income) - fixedPence - everydayPence),
      spent: fromPence(spent.get(month) ?? 0),
    };
  });
}

/**
 * Monthly savings left before `targetDate` (at least 1): the calendar-month
 * difference, e.g. 18 Nov 2026 → Nov 2027 is 12 monthly payments.
 */
export function monthsUntil(today: string, targetDate: string): number {
  const [y, m] = today.split("-").map(Number);
  const [ty, tm] = targetDate.split("-").map(Number);
  return Math.max(1, (ty - y) * 12 + (tm - m));
}

export function goalPlan(goal: SavingsGoal, today: string): GoalPlan {
  const remaining = Math.max(0, toPence(goal.targetAmount) - toPence(goal.savedAmount));
  if (!goal.targetDate) return { ...goal, monthlyNeed: remaining === 0 ? 0 : null, monthsLeft: null };
  const monthsLeft = monthsUntil(today, goal.targetDate);
  return { ...goal, monthlyNeed: fromPence(Math.ceil(remaining / monthsLeft)), monthsLeft };
}

export function buildPlan({
  fixedCosts,
  goals,
  history,
  income,
  today,
}: {
  fixedCosts: readonly FixedCost[];
  goals: readonly SavingsGoal[];
  history: readonly PlanMonth[];
  income: number | null;
  today: string;
}): PlanSummary {
  const fixedTotal = fixedCosts.reduce((s, f) => s + toPence(f.amount), 0);
  const planned = goals
    .map((g) => goalPlan(g, today))
    .sort((a, b) => (a.targetDate ?? "9999").localeCompare(b.targetDate ?? "9999") || a.name.localeCompare(b.name));
  const goalsMonthly = planned.reduce((s, g) => s + toPence(g.monthlyNeed ?? 0), 0);
  const totalSaved = goals.reduce((s, g) => s + toPence(g.savedAmount), 0);

  // Up to the last 3 complete months that have any spending recorded.
  const recent = history.filter((h) => h.complete && h.spent !== 0).slice(-3);
  const avgEveryday = recent.length ? Math.round(recent.reduce((s, h) => s + toPence(h.everyday), 0) / recent.length) : null;

  const incomePence = income === null ? null : toPence(income);
  const afterFixed = incomePence === null ? null : incomePence - fixedTotal;
  const leftToSpend = afterFixed === null ? null : afterFixed - goalsMonthly;
  const avgSaved = afterFixed === null || avgEveryday === null ? null : afterFixed - avgEveryday;

  const [y, m] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  let status: PlanStatus;
  if (incomePence === null) status = "no-income";
  else if (afterFixed! < goalsMonthly) status = "goals-unaffordable";
  else if (planned.length === 0) status = "no-goals";
  else if (avgSaved !== null && avgSaved < goalsMonthly) status = "behind";
  else status = "on-track";

  const suggested =
    afterFixed === null
      ? 0
      : Math.max(goalsMonthly, avgSaved !== null ? Math.max(0, avgSaved) : Math.round(afterFixed * 0.2));

  return {
    afterFixed: afterFixed === null ? null : fromPence(afterFixed),
    avgEveryday: avgEveryday === null ? null : fromPence(avgEveryday),
    avgSaved: avgSaved === null ? null : fromPence(avgSaved),
    fixedTotal: fromPence(fixedTotal),
    goals: planned,
    goalsMonthly: fromPence(goalsMonthly),
    income,
    leftToSpend: leftToSpend === null ? null : fromPence(leftToSpend),
    leftToSpendPerDay: leftToSpend === null ? null : fromPence(Math.floor(Math.max(0, leftToSpend) / daysInMonth)),
    status,
    suggestedMonthly: fromPence(Math.max(0, Math.min(suggested, Math.max(afterFixed ?? 0, 0)))),
    totalSaved: fromPence(totalSaved),
  };
}

export interface ProjectionPoint {
  label: string;
  /** Months from now (0 = today's balance). */
  month: number;
  total: number;
}

export interface GoalMilestone {
  id: string;
  name: string;
  /** "Aug 2027", or null if never reached at this rate. */
  reachedLabel: string | null;
  /** Months from now; 0 = already reached. */
  reachedMonth: number | null;
  /** true/false against the deadline; null without a deadline or if never reached. */
  onTime: boolean | null;
}

/**
 * Saving `monthly` every month from now. Goals are funded one after another,
 * nearest deadline first, which shows when each would be reached.
 */
export function projectSavings({
  goals,
  monthly,
  months = 24,
  start,
  today,
}: {
  goals: readonly GoalPlan[];
  monthly: number;
  months?: number;
  start: number;
  today: string;
}): { milestones: GoalMilestone[]; points: ProjectionPoint[] } {
  const [y, m] = today.split("-").map(Number);
  const labelFor = (k: number) => {
    const d = new Date(Date.UTC(y, m - 1 + k, 1));
    return `${MONTH_LABEL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const monthlyPence = Math.max(0, toPence(monthly));
  const points = Array.from({ length: months + 1 }, (_, k) => ({
    label: k === 0 ? "Now" : labelFor(k),
    month: k,
    total: fromPence(toPence(start) + monthlyPence * k),
  }));

  let cumulative = 0;
  const milestones = goals.map((g) => {
    cumulative += Math.max(0, toPence(g.targetAmount) - toPence(g.savedAmount));
    const reachedMonth = cumulative === 0 ? 0 : monthlyPence > 0 ? Math.ceil(cumulative / monthlyPence) : null;
    const deadlineMonths = g.targetDate ? monthsUntil(today, g.targetDate) : null;
    return {
      id: g.id,
      name: g.name,
      onTime: reachedMonth === null || deadlineMonths === null ? null : reachedMonth <= deadlineMonths,
      reachedLabel: reachedMonth === null ? null : reachedMonth === 0 ? "Reached" : labelFor(reachedMonth),
      reachedMonth,
    };
  });

  return { milestones, points };
}
