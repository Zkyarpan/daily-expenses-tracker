/**
 * src/lib/supabase/budgets.ts
 *
 * Data-access layer for the `budgets` table.
 * Mirrors the pattern of src/lib/supabase/expenses.ts:
 *  - Validates input before every write.
 *  - Includes user_id on every INSERT so RLS WITH CHECK passes.
 *  - RLS SELECT / UPDATE / DELETE policies ensure isolation without
 *    explicit user_id filters on reads/updates/deletes.
 */

import type { Budget, CreateBudgetInput, UpdateBudgetInput } from "@/entities/Budget";
import {
  assertValidCreateBudgetInput,
  assertValidUpdateBudgetInput,
} from "@/lib/budgetValidation";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------
async function getAuthUserId(): Promise<string> {
  if (!supabase) throw new Error("Supabase not initialised");
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated — please log in");
  return user.id;
}

// ---------------------------------------------------------------------------
// Fetch all budgets for the logged-in user
// RLS SELECT policy filters by user_id automatically.
// ---------------------------------------------------------------------------
export async function fetchBudgets(): Promise<Budget[]> {
  if (!supabase) throw new Error("Supabase not initialised");

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .order("categoryId", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(normaliseRow);
}

// ---------------------------------------------------------------------------
// Fetch budgets for a specific year/month
// ---------------------------------------------------------------------------
export async function fetchBudgetsByMonth(
  year: number,
  month: number,
): Promise<Budget[]> {
  if (!supabase) throw new Error("Supabase not initialised");

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("categoryId", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(normaliseRow);
}

// ---------------------------------------------------------------------------
// Fetch budgets for an inclusive range of years (analytics)
// RLS SELECT policy filters by user_id automatically.
// ---------------------------------------------------------------------------
export async function fetchBudgetsForYears(
  startYear: number,
  endYear: number,
): Promise<Budget[]> {
  if (!supabase) throw new Error("Supabase not initialised");

  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .gte("year", startYear)
    .lte("year", endYear)
    .order("year", { ascending: true })
    .order("month", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(normaliseRow);
}

/** Re-exported from the client-free queries module (also used server-side). */
export { isMissingTableError } from "@/lib/supabase/queries";

// ---------------------------------------------------------------------------
// Create a new budget
// ---------------------------------------------------------------------------
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  if (!supabase) throw new Error("Supabase not initialised");

  assertValidCreateBudgetInput(input);

  const userId = await getAuthUserId();

  const { data, error } = await supabase
    .from("budgets")
    .insert({
      categoryId: input.categoryId,
      createdAt: new Date().toISOString(),
      limitAmount: input.limitAmount,
      month: input.month,
      updatedAt: new Date().toISOString(),
      user_id: userId,
      year: input.year,
    })
    .select()
    .single();

  if (error) {
    // PostgreSQL UNIQUE violation code
    if (error.code === "23505") {
      throw new Error(
        "A budget for this category and month already exists.",
      );
    }
    throw error;
  }

  return normaliseRow(data);
}

// ---------------------------------------------------------------------------
// Update an existing budget's limit
// RLS UPDATE policy ensures only the owner's row is matched.
// ---------------------------------------------------------------------------
export async function updateBudget(input: UpdateBudgetInput): Promise<Budget> {
  if (!supabase) throw new Error("Supabase not initialised");

  assertValidUpdateBudgetInput(input);

  const { data, error } = await supabase
    .from("budgets")
    .update({
      limitAmount: input.limitAmount,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select()
    .single();

  if (error) throw error;

  return normaliseRow(data);
}

// ---------------------------------------------------------------------------
// Delete a budget
// RLS DELETE policy ensures only the owner's row is deleted.
// ---------------------------------------------------------------------------
export async function deleteBudget(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase not initialised");

  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Internal normaliser — converts raw Supabase row to Budget type
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseRow(row: any): Budget {
  return {
    categoryId: row.categoryId,
    createdAt: new Date(row.createdAt),
    id: row.id,
    limitAmount: Number(row.limitAmount),
    month: Number(row.month),
    updatedAt: new Date(row.updatedAt),
    userId: row.user_id,
    year: Number(row.year),
  };
}
