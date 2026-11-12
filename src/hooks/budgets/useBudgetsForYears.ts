/**
 * src/hooks/budgets/useBudgetsForYears.ts
 *
 * Feature 6: loads the signed-in user's budgets for a span of years so the
 * analytics page can compare budget versus actual across any period.
 *
 * Status values:
 *  - "ready"        budgets loaded (possibly an empty list)
 *  - "unavailable"  demo mode, or the budgets table does not exist yet
 *                   (migration not applied) — the UI explains this instead of
 *                   showing zero or invented figures
 *  - "error"        any other failure
 */

import { useQuery } from "@tanstack/react-query";

import type { Budget } from "@/entities/Budget";
import { supabase } from "@/lib/supabase";
import { fetchBudgetsForYears, isMissingTableError } from "@/lib/supabase/budgets";

export type BudgetsForYearsStatus = "loading" | "ready" | "unavailable" | "error";

type Result = { budgets: Budget[] | null; unavailable: boolean };

export function useBudgetsForYears(startYear: number, endYear: number) {
  const query = useQuery({
    queryFn: async (): Promise<Result> => {
      if (!supabase) return { budgets: null, unavailable: true };
      try {
        return { budgets: await fetchBudgetsForYears(startYear, endYear), unavailable: false };
      } catch (error) {
        if (isMissingTableError(error)) return { budgets: null, unavailable: true };
        throw error;
      }
    },
    // Prefix ["budgets"] so budget mutations invalidate this entry too.
    queryKey: ["budgets", "years", startYear, endYear],
    retry: (failureCount, error) => {
      if (error && typeof error === "object" && "code" in error) {
        const code = (error as { code: string }).code;
        if (code === "42501" || code === "PGRST301") return false;
      }
      return failureCount < 1;
    },
    staleTime: 5 * 60 * 1000,
  });

  const status: BudgetsForYearsStatus = query.isPending
    ? "loading"
    : query.isError
      ? "error"
      : query.data.unavailable
        ? "unavailable"
        : "ready";

  return {
    budgets: query.data?.budgets ?? null,
    error: query.error,
    status,
  };
}
