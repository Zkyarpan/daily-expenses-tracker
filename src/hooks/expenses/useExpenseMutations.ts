// src/hooks/useExpenseMutations.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { CreateExpenseInput, Expense } from "@/entities/Expense";
import { getIsDemoMode } from "@/lib/supabase";
import {
  createExpense,
  deleteExpense,
  deleteExpenses,
  saveAll,
  updateExpense,
} from "@/lib/supabase/expenses";

const isDemoMode = getIsDemoMode();

export const useExpenseMutations = (year: number, month: number) => {
  const queryClient = useQueryClient();
  // month is 0-based here (matches useExpenses convention).
  // Budgets use 1-based months in their query keys.
  const queryKey = ["expenses", year, month];
  const budgetsQueryKey = ["budgets", year, month + 1];

  /** Invalidate both expenses and budgets caches so spending recalculates. */
  const invalidateBoth = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: budgetsQueryKey });
    // Dashboard, Yearly Charts and Analytics read whole-year caches. Every year
    // is invalidated because an edit can move an expense to a different year.
    // Only queries currently on screen refetch; the rest refetch on next use.
    queryClient.invalidateQueries({ queryKey: ["yearly-expenses"] });
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
    // Dialog-based CRUD
    createFromInput: createFromInputMutation.mutateAsync,
    updateFromInput: updateMutation.mutateAsync,
    // Legacy inline-row mutations (spreadsheet mode)
    create: createMutation.mutate,
    saveAll: saveAllMutation.mutate,
    saveAllAsync: saveAllMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    bulkDelete: bulkDeleteMutation.mutate,
    bulkDeleteAsync: bulkDeleteMutation.mutateAsync,
    // Loading states
    isCreating: createFromInputMutation.isPending || createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isSaving: saveAllMutation.isPending,
    isDeleting: bulkDeleteMutation.isPending || deleteMutation.isPending,
    isPending:
      createMutation.isPending ||
      createFromInputMutation.isPending ||
      updateMutation.isPending ||
      saveAllMutation.isPending ||
      deleteMutation.isPending,
  };
};
