import type { Expense } from "@/entities/Expense";
import {
  assertValidCreateInput,
  assertValidUpdateInput,
} from "@/lib/expenseValidation";
import { supabase } from "@/lib/supabase";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

// ---------------------------------------------------------------------------
// Internal helper: get the authenticated user's UUID.
// Throws if not authenticated so callers always get a meaningful error.
// ---------------------------------------------------------------------------
async function getAuthUserId(): Promise<string> {
  if (!supabase) throw new Error("Supabase not initialised");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated — please log in");
  return user.id;
}

/**
 * ---------- Read all expenses in an inclusive date window ----------
 *
 * Used by the yearly / analytics queries. Pages through results (see
 * fetchExpenseRowsBetween) so totals are never silently truncated.
 *
 * Security: the RLS SELECT policy (user_id = auth.uid()) is the real
 * enforcement. The explicit user_id filter is defence in depth, and no
 * request is made at all without a signed-in session.
 */
export async function fetchExpensesBetween(
  startDate: string, // YYYY-MM-DD, inclusive
  endDate: string, // YYYY-MM-DD, inclusive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  if (!supabase) throw new Error("Supabase not initialised");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  return fetchExpenseRowsBetween(supabase, userId, startDate, endDate);
}

/** ---------- Create single expense ----------*/
export async function createExpense(
  expense: Omit<Expense, "createdAt" | "updatedAt">,
) {
  if (!supabase) throw new Error("Supabase not initialised");

  // Validate financial data before sending to the database.
  assertValidCreateInput({
    amount: expense.amount,
    categoryId: expense.categoryId,
    date: expense.date as Date,
    description: expense.description,
    tagId: expense.tagId,
  });

  // Explicitly supply user_id so the insert works regardless of whether the
  // column has a DEFAULT auth.uid() clause.  The RLS INSERT policy
  // (WITH CHECK (user_id = auth.uid())) ensures the value matches the session.
  const userId = await getAuthUserId();

  // Normalise date to YYYY-MM-DD string for the `date` (DATE) column.
  const dateStr = expense.date instanceof Date
    ? expense.date.toISOString().split("T")[0]
    : String(expense.date).split("T")[0];

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      amount: expense.amount,
      "categoryId": expense.categoryId,
      "createdAt": new Date().toISOString(),
      date: dateStr,
      description: expense.description,
      id: expense.id,
      "memberId": expense.memberId,
      "tagId": expense.tagId,
      "updatedAt": new Date().toISOString(),
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** ---------- saveAll (bulk upsert) ----------*/
export async function saveAll(expenses: Expense[]) {
  if (!supabase) throw new Error("Supabase not initialised");

  // Validate every row before the bulk upsert.
  for (const expense of expenses) {
    assertValidCreateInput({
      amount: expense.amount,
      categoryId: expense.categoryId,
      date: expense.date as Date,
      description: expense.description,
      tagId: expense.tagId,
    });
  }

  const userId = await getAuthUserId();

  const expensesToSave = expenses.map(
    ({ id, amount, memberId, categoryId, tagId, date, description, createdAt }) => ({
      amount,
      "categoryId": categoryId,
      "createdAt": createdAt,
      date,
      description,
      id,
      "memberId": memberId,
      "tagId": tagId,
      "updatedAt": new Date().toISOString(),
      user_id: userId,
    }),
  );

  const { data, error } = await supabase
    .from("expenses")
    .upsert(expensesToSave, { onConflict: "id" })
    .select();

  if (error) throw error;
  return data;
}

/** ---------- Update single expense ----------*/
export async function updateExpense(
  id: string,
  updates: Partial<Omit<Expense, "id" | "createdAt" | "updatedAt" | "userId">>,
) {
  if (!supabase) throw new Error("Supabase not initialised");

  assertValidUpdateInput({
    amount: updates.amount,
    categoryId: updates.categoryId,
    date: updates.date as Date | undefined,
    description: updates.description,
    id,
    tagId: updates.tagId,
  });

  // Normalise the date field if provided
  const normDate = updates.date instanceof Date
    ? updates.date.toISOString().split("T")[0]
    : updates.date
      ? String(updates.date).split("T")[0]
      : undefined;

  const { data, error } = await supabase
    .from("expenses")
    .update({
      ...(updates.amount      !== undefined && { amount:       updates.amount }),
      ...(updates.categoryId  !== undefined && { "categoryId": updates.categoryId }),
      ...(normDate            !== undefined && { date:         normDate }),
      ...(updates.description !== undefined && { description:  updates.description }),
      ...(updates.memberId    !== undefined && { "memberId":   updates.memberId }),
      ...(updates.tagId       !== undefined && { "tagId":      updates.tagId }),
      "updatedAt": new Date().toISOString(),
    })
    // RLS UPDATE policy (USING user_id = auth.uid()) ensures only the owner's row matches.
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** ---------- DELETE single expense ----------*/
export async function deleteExpense(id: string) {
  if (!supabase) throw new Error("Supabase not initialised");
  // RLS DELETE policy ensures only the owner's row is deleted.
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

/** ---------- DELETE multiple expenses ----------*/
export async function deleteExpenses(ids: string[]) {
  if (!supabase) throw new Error("Supabase not initialised");
  // RLS DELETE policy ensures only the owner's rows are deleted.
  const { error } = await supabase.from("expenses").delete().in("id", ids);
  if (error) throw error;
}
