/**
 * src/hooks/budgets/useBudgetMutations.ts
 *
 * React Query mutations for creating, updating and deleting budgets.
 * Each successful mutation invalidates both the budgets and expenses query
 * caches so that spending calculations are always up-to-date.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreateBudgetInput, UpdateBudgetInput } from "@/entities/Budget";
import {
  createBudget,
  deleteBudget,
  updateBudget,
} from "@/lib/supabase/budgets";

// The year/month arguments are kept for API compatibility with existing callers.
export function useBudgetMutations(_year: number, _month: number) {
  const queryClient = useQueryClient();

  /**
   * Invalidate every budgets query: the current month (Budgets page) and the
   * multi-year analytics query (["budgets", "years", …]). Only active queries
   * refetch immediately.
   */
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["budgets"] });

  const create = useMutation({
    mutationFn: (input: CreateBudgetInput) => createBudget(input),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: (input: UpdateBudgetInput) => updateBudget(input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: invalidate,
  });

  return { create, remove, update };
}
