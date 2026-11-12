import { useQuery } from "@tanstack/react-query";

import { expensesData } from "@/components/expenses/data/expenseData";
import { ExpenseWithDetails } from "@/entities/Expense";
import { parseLocalDate } from "@/lib/dateUtils";
import { getIsDemoMode, supabase } from "@/lib/supabase";
import { fetchExpensesBetween } from "@/lib/supabase/expenses";
import { transformToExpenseWithDetails } from "@/lib/utils";

const isDemoMode = getIsDemoMode();

// Demo data fetcher for full year
const fetchDemoYearlyExpenses = async (
  year: number,
): Promise<ExpenseWithDetails[]> => {
  // Simulate API delay for realism
  await new Promise((resolve) => setTimeout(resolve, 500));

  const filteredExpenses = expensesData.filter((expense) => {
    const expenseDate = parseLocalDate(expense.date as unknown as string);
    return expenseDate.getFullYear() === year;
  });

  return transformToExpenseWithDetails(filteredExpenses);
};

// Real API fetcher for full year — paginated and scoped to the signed-in
// user (see fetchExpensesBetween), so large years are never truncated.
const fetchApiYearlyExpenses = async (
  year: number,
): Promise<ExpenseWithDetails[]> => {
  // Check if supabase is available
  if (!supabase) {
    console.warn("Supabase not available, returning empty expenses");
    return [];
  }

  const rows = await fetchExpensesBetween(`${year}-01-01`, `${year}-12-31`);
  return transformToExpenseWithDetails(rows);
};

/**
 * Shared query options for one calendar year of expenses. Used by
 * useYearlyExpenses and by the analytics page (via useQueries), so the
 * Dashboard, Yearly Charts and Analytics all share one cache entry per year.
 */
export const yearlyExpensesQueryOptions = (year: number) => ({
  queryFn: () =>
    isDemoMode ? fetchDemoYearlyExpenses(year) : fetchApiYearlyExpenses(year),
  queryKey: ["yearly-expenses", year] as const,
  staleTime: isDemoMode ? Infinity : 5 * 60 * 1000, // Demo data never stale, API data stale after 5 minutes
});

export const useYearlyExpenses = (year: number) => {
  return useQuery(yearlyExpensesQueryOptions(year));
};
