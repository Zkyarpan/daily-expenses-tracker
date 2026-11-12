/**
 * src/lib/insights/summary.ts
 *
 * Feature 7: builds the aggregated InsightsSummary for one month — the only
 * data that is ever sent to the AI provider.
 *
 * Pure and deterministic (no I/O). Reuses the Feature 6 analytics functions
 * (pence-exact sums, local-date filtering, alert-consistent budget status).
 *
 * Privacy by construction: the output is assembled field by field from
 * aggregates. Input expenses may carry descriptions, tags or member IDs, but
 * none of those fields are read, so they cannot reach the summary.
 */

import { ALERT_THRESHOLDS } from "@/entities/Alert";
import type { InsightsSummary } from "@/entities/Insights";
import {
  type AnalyticsBudget,
  type AnalyticsExpense,
  budgetPerformance,
  enumerateMonths,
  expenseDateKey,
  filterExpenses,
  groupByCategory,
  percentChange,
  resolvePeriod,
  sumAmounts,
} from "@/lib/analytics";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Months of history included in the trend (including the selected month). */
export const TREND_MONTHS = 6;
/** Most categories listed (all nine defaults + uncategorised fit). */
const MAX_CATEGORIES = 10;
/** Reduction used for the "cut your largest category" savings scenario. */
export const SAVINGS_REDUCTION_PCT = 10;

const money = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Date range covering the trend window ending in the selected month. */
export const insightsDateRange = (year: number, month1: number) => {
  const start = new Date(year, month1 - 1 - (TREND_MONTHS - 1), 1);
  const end = new Date(year, month1, 0);
  return { end, start };
};

export type BuildSummaryInput = {
  expenses: readonly AnalyticsExpense[];
  /** Budgets for the selected month, or null if budgets are unavailable. */
  budgets: readonly AnalyticsBudget[] | null;
  year: number;
  /** 1-based month */
  month: number;
  today: Date;
  nameOf: (categoryKey: string) => string;
};

export function buildInsightsSummary({
  budgets,
  expenses,
  month,
  nameOf,
  today,
  year,
}: BuildSummaryInput): InsightsSummary {
  const month0 = month - 1;
  const range = resolvePeriod({ kind: "month", month: month0, year });
  const prevRange = resolvePeriod({
    kind: "month",
    month: month0 === 0 ? 11 : month0 - 1,
    year: month0 === 0 ? year - 1 : year,
  });

  const current = filterExpenses(expenses, range);
  const previous = filterExpenses(expenses, prevRange);

  const spending = sumAmounts(current.map((e) => e.amount));
  const previousMonthSpending = sumAmounts(previous.map((e) => e.amount));

  // ── Period progress (projection only makes sense for the current month) ──
  const daysInMonth = range.end.getDate();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month0;
  const isPast = today > range.end;
  const daysElapsed = isCurrentMonth ? today.getDate() : isPast ? daysInMonth : 0;
  // Multiply before dividing (in pence) so e.g. £200.75 × 30 / 12 is exactly £501.875 → £501.88.
  const project = (amount: number) =>
    isCurrentMonth && daysElapsed > 0
      ? Math.round((Math.round(amount * 100) * daysInMonth) / daysElapsed) / 100
      : null;

  // ── Trend: last TREND_MONTHS months, oldest first ────────────────────────
  const trendRange = insightsDateRange(year, month);
  const monthTotals = new Map<string, number[]>();
  for (const e of filterExpenses(expenses, trendRange)) {
    const key = expenseDateKey(e.date).slice(0, 7);
    const list = monthTotals.get(key) ?? [];
    list.push(e.amount);
    monthTotals.set(key, list);
  }
  const monthlyTrend = enumerateMonths(trendRange).map((m) => ({
    month: `${MONTH_NAMES[m.month].slice(0, 3)} ${m.year}`,
    total: sumAmounts(monthTotals.get(m.key) ?? []),
  }));
  const priorWithSpending = monthlyTrend.slice(0, -1).filter((m) => m.total !== 0);
  const priorMonthsAverage =
    priorWithSpending.length > 0
      ? money(sumAmounts(priorWithSpending.map((m) => m.total)) / priorWithSpending.length)
      : null;

  // ── Categories (this month vs previous month) ───────────────────────────
  const previousByCategory = new Map(groupByCategory(previous, nameOf).map((c) => [c.key, c.total]));
  const categories = groupByCategory(current, nameOf)
    .slice(0, MAX_CATEGORIES)
    .map((c) => {
      const prev = previousByCategory.get(c.key) ?? 0;
      return {
        category: c.name,
        changePct: pct(percentChange(c.total, prev)),
        previousMonthTotal: money(prev),
        sharePct: pct(c.share) ?? 0,
        total: money(c.total),
        transactions: c.count,
      };
    });

  // ── Budgets for the month ───────────────────────────────────────────────
  let budgetSection: InsightsSummary["budgets"] = null;
  if (budgets) {
    const perf = budgetPerformance(budgets, current, range, nameOf);
    budgetSection = {
      rows: perf.rows.map((r) => ({
        category: r.name,
        limit: money(r.limit),
        projectedSpend: project(r.spent),
        remaining: money(r.remaining),
        spent: money(r.spent),
        status: r.status,
        utilisationPct: pct(r.utilisation) ?? 0,
      })),
      totalLimit: money(perf.totalLimit),
      totalSpent: money(perf.totalSpent),
      utilisationPct: pct(perf.utilisation),
    };
  }

  // ── Deterministic savings opportunities (the AI may only quote these) ───
  const savingsOpportunities: InsightsSummary["savingsOpportunities"] = [];
  for (const row of budgetSection?.rows ?? []) {
    if (row.remaining < 0) {
      savingsOpportunities.push({
        action: `Bring ${row.category} back within its ${MONTH_NAMES[month0]} budget`,
        amount: money(-row.remaining),
        reductionPct: null,
      });
    }
  }
  const largest = categories.find((c) => c.total > 0);
  if (largest) {
    savingsOpportunities.push({
      
      action: `Reduce ${largest.category} spending by ${SAVINGS_REDUCTION_PCT}%`,
      // In pence: 10% of £200.75 is 2007.5p → £20.08 (float maths gives £20.07).
amount: Math.round((Math.round(largest.total * 100) * SAVINGS_REDUCTION_PCT) / 100) / 100,
      reductionPct: SAVINGS_REDUCTION_PCT,
    });
  }
  const comparable = project(spending) ?? spending;
  if (priorMonthsAverage !== null && comparable > priorMonthsAverage) {
    savingsOpportunities.push({
      action: "Return to your average monthly spending from recent months",
      amount: money(comparable - priorMonthsAverage),
      reductionPct: null,
    });
  }

  return {
    budgets: budgetSection,
    categories,
    currency: "GBP",
    monthlyTrend,
    period: {
      daysElapsed,
      daysInMonth,
      isCurrentMonth,
      label: `${MONTH_NAMES[month0]} ${year}`,
      month,
      year,
    },
    savingsOpportunities: savingsOpportunities.slice(0, 4),
    thresholds: { limitPct: ALERT_THRESHOLDS.critical, warningPct: ALERT_THRESHOLDS.warning },
    totals: {
      averageTransaction: current.length > 0 ? money(spending / current.length) : 0,
      changeVsPreviousMonth: money(spending - previousMonthSpending),
      changeVsPreviousMonthPct: pct(percentChange(spending, previousMonthSpending)),
      previousMonthSpending: money(previousMonthSpending),
      priorMonthsAverage,
      projectedMonthEnd: project(spending),
      spending: money(spending),
      transactions: current.length,
    },
  };
}
