"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { planApi } from "@/lib/api/plan";
import type { FixedCostUpdate, GoalUpdate } from "@/lib/plan/schemas";
import { getIsDemoMode } from "@/lib/supabase";

export const PLAN_KEY = ["plan"] as const;

/** Salary, fixed costs, goals, history and the computed plan (GET /api/plan). */
export const usePlan = () => useQuery({ enabled: !getIsDemoMode(), queryFn: planApi.get, queryKey: PLAN_KEY });

/** Writes for fixed costs and goals; each one refreshes the plan and Home's money overview. */
export function usePlanMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: PLAN_KEY }),
      queryClient.invalidateQueries({ queryKey: ["money"] }),
    ]);

  return {
    createFixedCost: useMutation({ mutationFn: planApi.createFixedCost, onSuccess }),
    createGoal: useMutation({ mutationFn: planApi.createGoal, onSuccess }),
    deleteFixedCost: useMutation({ mutationFn: planApi.deleteFixedCost, onSuccess }),
    deleteGoal: useMutation({ mutationFn: planApi.deleteGoal, onSuccess }),
    updateFixedCost: useMutation({
      mutationFn: ({ id, update }: { id: string; update: FixedCostUpdate }) => planApi.updateFixedCost(id, update),
      onSuccess,
    }),
    updateGoal: useMutation({
      mutationFn: ({ id, update }: { id: string; update: GoalUpdate }) => planApi.updateGoal(id, update),
      onSuccess,
    }),
  };
}
