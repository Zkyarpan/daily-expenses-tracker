/**
 * src/hooks/budgets/useBudgets.ts
 *
 * React Query hook to fetch the logged-in user's budgets for a given
 * year/month and compute spending progress from the expenses query.
 *
 * Automatic recalculation: the budgets query only fetches budget rows.
 * Spending is derived (useMemo) from the reactive useExpenses query for the
 * same month, so any expense mutation that invalidates ["expenses", year,
 * month0] recomputes BudgetWithSpending values once the fresh expenses arrive.
 * Deriving after both queries resolve avoids reading a stale expenses cache
 * inside the budgets queryFn when both are refetched in parallel.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Budget, BudgetWithSpending } from "@/entities/Budget";
import { useExpenses } from "@/hooks/expenses/useExpenses";
import { computeBudgetsWithSpending } from "@/lib/budgetValidation";
import { DEFAULT_CATEGORIES } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { fetchBudgetsByMonth, isMissingTableError } from "@/lib/supabase/budgets";

const NO_BUDGETS: BudgetWithSpending[] = [];
const CATEGORY_NAMES: ReadonlyMap<string, string> = new Map(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
);

export function useBudgets(year: number, month: number) {
  // useExpenses uses a 0-based month in its query key; useBudgets receives 1-based.
  const month0ForExpenses = month - 1;

  const budgetsQuery = useQuery({
    queryFn: async (): Promise<{ budgets: Budget[]; tableMissing: boolean }> => {
      if (!supabase) return { budgets: [], tableMissing: false };
      try {
        return { budgets: await fetchBudgetsByMonth(year, month), tableMissing: false };
      } catch (error) {
        // PGRST205: the budgets migration has not been applied yet. That is a
        // setup step, not a failure — report it so the page can explain it.
        if (isMissingTableError(error)) return { budgets: [], tableMissing: true };
        throw error;
      }
    },
    queryKey: ["budgets", year, month],
    // Retry once, skip on auth/RLS errors
    retry: (failureCount, error) => {
      if (error && typeof error === "object" && "code" in error) {
        const code = (error as { code: string }).code;
        if (code === "42501" || code === "PGRST301") return false;
      }
      return failureCount < 1;
    },
    // Never use cached budgets for more than 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  // Same query (and cache entry) the expenses page uses, so it is shared.
  const expensesQuery = useExpenses(year, month0ForExpenses);

  const budgets = budgetsQuery.data?.budgets;
  const expenses = expensesQuery.data;

  // Stable reference: only changes when budgets or expenses data change.
  const data = useMemo<BudgetWithSpending[]>(() => {
    if (!budgets || budgets.length === 0) return NO_BUDGETS;
    return computeBudgetsWithSpending(budgets, expenses ?? [], year, month, CATEGORY_NAMES);
  }, [budgets, expenses, year, month]);

  return {
    data,
    error: budgetsQuery.error ?? expensesQuery.error,
    isError: budgetsQuery.isError || expensesQuery.isError,
    // Wait for expenses too, so cards never flash 0 spent before data arrives.
    isLoading: budgetsQuery.isLoading || expensesQuery.isLoading,
    /**
     * True only when BOTH budgets and expenses loaded successfully. While
     * either is pending or failed, `data` is an empty placeholder, so alert
     * recalculation must not treat it as "this month has no budgets".
     */
    isSuccess: budgetsQuery.isSuccess && expensesQuery.isSuccess,
    /** True when the budgets table does not exist yet (migration not applied). */
    isTableMissing: budgetsQuery.data?.tableMissing ?? false,
  };
}
