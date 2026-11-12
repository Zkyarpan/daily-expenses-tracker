/**
 * src/hooks/analytics/useAnalytics.ts
 *
 * Feature 6: loads exactly the data the selected period needs and derives
 * every analytics figure from it in one memoised pass.
 *
 * Data loading
 *  - Expenses are fetched per calendar year through the same query options as
 *    useYearlyExpenses (key ["yearly-expenses", year]), so the Dashboard,
 *    Yearly Charts and Analytics share one cache entry per year. Changing the
 *    month, category or a range inside already-loaded years makes no request.
 *  - Years loaded = the selected period + the comparison period + the
 *    previous year (for the year-on-year chart).
 *  - Budgets for the same years come from useBudgetsForYears.
 *
 * Rendering
 *  - buildAnalytics runs once per change of data or filters (useMemo); every
 *    card, chart and report reads from that single result, so they always
 *    agree with each other.
 *  - While a newly selected year loads, the last result stays on screen
 *    (marked as updating) instead of flashing back to skeletons.
 */

import { useMemo, useState } from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";

import type { ExpenseWithDetails } from "@/entities/Expense";
import { type BudgetsForYearsStatus, useBudgetsForYears } from "@/hooks/budgets/useBudgetsForYears";
import { yearlyExpensesQueryOptions } from "@/hooks/yearly-expenses/useYearlyExpenses";
import {
  type AnalyticsResult,
  buildAnalytics,
  type PeriodSelection,
  previousPeriod,
  resolvePeriod,
  yearsSpanned,
} from "@/lib/analytics";
import { categoryNameOf } from "@/lib/categoryNames";
import { timed } from "@/lib/perf";

/** Category key → display name (stable module-level function). */
export { categoryNameOf };

/** Stable combine function → TanStack memoises its result between renders. */
const combineYears = (results: UseQueryResult<ExpenseWithDetails[]>[]) => ({
  error: results.find((r) => r.error)?.error ?? null,
  expenses: results.flatMap((r) => r.data ?? []),
  isFetching: results.some((r) => r.isFetching),
  isPending: results.some((r) => r.isPending),
});

export type UseAnalyticsResult = {
  data: AnalyticsResult | null;
  /** True only before the first result is available. */
  isLoading: boolean;
  /** True while newer data is loading behind a result already on screen. */
  isUpdating: boolean;
  error: unknown;
  budgetsStatus: BudgetsForYearsStatus;
  budgetsError: unknown;
  /** Years fetched for this selection. */
  years: number[];
  /** Expense records loaded across those years. */
  recordsLoaded: number;
  /** Time spent in buildAnalytics for the latest result, in ms. */
  computeMs: number | null;
};

export function useAnalytics(
  selection: PeriodSelection,
  categoryKeys: readonly string[],
): UseAnalyticsResult {
  // "Today" is fixed for the lifetime of the page so results are stable.
  const today = useMemo(() => new Date(), []);

  const years = useMemo(() => {
    const range = resolvePeriod(selection);
    const endYear = range.end.getFullYear();
    return yearsSpanned(range, previousPeriod(selection), {
      end: new Date(endYear, 11, 31),
      start: new Date(endYear - 1, 0, 1),
    });
  }, [selection]);

  const yearData = useQueries({
    combine: combineYears,
    queries: years.map((year) => yearlyExpensesQueryOptions(year)),
  });

  const budgetsQuery = useBudgetsForYears(years[0], years[years.length - 1]);
  const budgets = budgetsQuery.status === "ready" ? budgetsQuery.budgets : null;

  const computed = useMemo(() => {
    if (yearData.isPending || yearData.error) return null;
    const { ms, result } = timed(() =>
      buildAnalytics({
        budgets,
        categoryKeys,
        expenses: yearData.expenses,
        nameOf: categoryNameOf,
        selection,
        today,
      }),
    );
    return { computeMs: ms, data: result, records: yearData.expenses.length };
  }, [yearData.isPending, yearData.error, yearData.expenses, budgets, categoryKeys, selection, today]);

  // Keep the last good result visible while a newly selected year loads
  // ("storing information from previous renders" pattern — no ref, no effect).
  const [lastComputed, setLastComputed] = useState(computed);
  if (computed && computed !== lastComputed) setLastComputed(computed);
  const shown = computed ?? (yearData.error ? null : lastComputed);

  return {
    budgetsError: budgetsQuery.error,
    budgetsStatus: budgetsQuery.status,
    computeMs: shown?.computeMs ?? null,
    data: shown?.data ?? null,
    error: yearData.error,
    isLoading: !shown && !yearData.error,
    isUpdating: !!shown && (yearData.isPending || yearData.isFetching || budgetsQuery.status === "loading"),
    recordsLoaded: shown?.records ?? 0,
    years,
  };
}
