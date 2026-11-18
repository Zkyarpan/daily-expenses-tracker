/**
 * src/lib/api/plan.ts — browser client for the Savings plan (/api/plan/**).
 */

import type {
  FixedCost,
  FixedCostCreate,
  FixedCostUpdate,
  GoalCreate,
  GoalUpdate,
  PlanResponse,
  SavingsGoal,
} from "@/lib/plan/schemas";

import { json, request } from "./client";
import { localToday } from "./money";

const id = (value: string) => encodeURIComponent(value);

export const planApi = {
  createFixedCost: (input: FixedCostCreate) =>
    request<{ fixedCost: FixedCost }>("/api/plan/fixed-costs", json("POST", input)),
  createGoal: (input: GoalCreate) => request<{ goal: SavingsGoal }>("/api/plan/goals", json("POST", input)),
  deleteFixedCost: (fixedCostId: string) =>
    request<{ deleted: true }>(`/api/plan/fixed-costs/${id(fixedCostId)}`, json("DELETE")),
  deleteGoal: (goalId: string) => request<{ deleted: true }>(`/api/plan/goals/${id(goalId)}`, json("DELETE")),
  get: () => request<PlanResponse>(`/api/plan?today=${localToday()}`),
  updateFixedCost: (fixedCostId: string, update: FixedCostUpdate) =>
    request<{ fixedCost: FixedCost }>(`/api/plan/fixed-costs/${id(fixedCostId)}`, json("PATCH", update)),
  updateGoal: (goalId: string, update: GoalUpdate) =>
    request<{ goal: SavingsGoal }>(`/api/plan/goals/${id(goalId)}`, json("PATCH", update)),
};
