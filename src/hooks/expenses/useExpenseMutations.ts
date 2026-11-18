// src/hooks/useExpenseMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CreateExpenseInput, Expense } from "@/entities/Expense";
import { invalidateSpendingQueries } from "@/lib/spendingQueries";
import { getIsDemoMode } from "@/lib/supabase";
import {
  createExpense,
  deleteExpense,
  deleteExpenses,
  saveAll,
  updateExpense,
} from "@/lib/supabase/expenses";

const isDemoMode = getIsDemoMode();

// year/month (0-based) are kept for API compatibility with existing callers.
export const useExpenseMutations = (_year: number, _month: number) => {
  const queryClient = useQueryClient();

  /**
   * Invalidate every expenses month plus the budgets and yearly caches, so
   * spending, budgets and alerts recalculate for whichever month the change
   * landed in (see invalidateSpendingQueries).
   */
  const invalidateBoth = () => {
    void invalidateSpendingQueries(queryClient);
  };

  // ── CREATE ────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (expense: Omit<Expense, "createdAt" | "updatedAt">) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          ...expense,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Expense;
      }
      return createExpense(expense);
    },
    onSuccess: invalidateBoth,
  });

  // ── CREATE from dialog (CreateExpenseInput shape) ────────────────────────

  const createFromInputMutation = useMutation({
    mutationFn: async ({
      input,
      tempId,
    }: {
      input: CreateExpenseInput;
      tempId: string;
    }) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return {
          ...input,
          createdAt: new Date(),
          id: tempId,
          updatedAt: new Date(),
        } as Expense;
      }
      // user_id is enforced by RLS INSERT policy — not passed from client
      return createExpense({
        amount: input.amount,
        categoryId: input.categoryId,
        date: typeof input.date === "string" ? new Date(input.date) : input.date,
        description: input.description,
        id: tempId,
        memberId: null,
        tagId: input.tagId,
      });
    },
    onSuccess: invalidateBoth,
  });

  // ── UPDATE (dialog-based, single expense) ────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: CreateExpenseInput;
    }) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { id, ...input } as unknown as Expense;
      }
      return updateExpense(id, {
        amount: input.amount,
        categoryId: input.categoryId,
        date: typeof input.date === "string" ? new Date(input.date) : input.date,
        description: input.description,
        tagId: input.tagId,
      });
    },
    onSuccess: invalidateBoth,
  });

  // ── SAVE ALL (spreadsheet bulk upsert) ──────────────────────────────────

  const saveAllMutation = useMutation({
    mutationFn: async (expenses: Expense[]) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return expenses;
      }
      return saveAll(expenses);
    },
    onSuccess: invalidateBoth,
  });

  // ── DELETE single ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return id;
      }
      await deleteExpense(id);
      return id;
    },
    onSuccess: invalidateBoth,
  });

  // ── DELETE bulk ──────────────────────────────────────────────────────────

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (isDemoMode) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return ids;
      }
      await deleteExpenses(ids);
      return ids;
    },
    onSuccess: invalidateBoth,
  });

  return {
    bulkDelete: bulkDeleteMutation.mutate,
    bulkDeleteAsync: bulkDeleteMutation.mutateAsync,
    // Legacy inline-row mutations (spreadsheet mode)
    create: createMutation.mutate,
    // Dialog-based CRUD
    createFromInput: createFromInputMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    // Loading states
    isCreating: createFromInputMutation.isPending || createMutation.isPending,
    isDeleting: bulkDeleteMutation.isPending || deleteMutation.isPending,
    isPending:
      createMutation.isPending ||
      createFromInputMutation.isPending ||
      updateMutation.isPending ||
      saveAllMutation.isPending ||
      deleteMutation.isPending,
    isSaving: saveAllMutation.isPending,
    isUpdating: updateMutation.isPending,
    saveAll: saveAllMutation.mutate,
    saveAllAsync: saveAllMutation.mutateAsync,
    updateFromInput: updateMutation.mutateAsync,
  };
};
