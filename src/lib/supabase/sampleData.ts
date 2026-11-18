/**
 * src/lib/supabase/sampleData.ts
 *
 * Server-side store for the sample dataset (src/lib/sampleData.ts), used by
 * /api/profile/sample-data. The caller passes the request's cookie-bound
 * Supabase client and the verified user id, so:
 *  - every inserted row carries that user_id (and RLS checks it), and
 *  - every count/delete filters on user_id AND the sample id range, so only
 *    the caller's sample rows are ever touched — never their own records.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SampleDataCounts } from "@/lib/profile/schemas";
import { generateSampleData, SAMPLE_ID_MAX, SAMPLE_ID_MIN } from "@/lib/sampleData";
import { isMissingTableError } from "@/lib/supabase/queries";
import { getErrorMessage } from "@/lib/utils";

const CHUNK = 200;

const chunks = <T>(rows: T[]) =>
  Array.from({ length: Math.ceil(rows.length / CHUNK) }, (_, i) => rows.slice(i * CHUNK, (i + 1) * CHUNK));

/** Sample rows in `table` (0 if the table is missing or its ids are not UUIDs). */
async function countSample(client: SupabaseClient, userId: string, table: string) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("id", SAMPLE_ID_MIN)
    .lte("id", SAMPLE_ID_MAX);
  return error ? 0 : (count ?? 0);
}

export async function countSampleData(client: SupabaseClient, userId: string): Promise<SampleDataCounts> {
  const [expenses, budgets, trackers, ious, wishlist] = await Promise.all([
    countSample(client, userId, "expenses"),
    countSample(client, userId, "budgets"),
    countSample(client, userId, "trackers"),
    countSample(client, userId, "ious"),
    countSample(client, userId, "wishlist_items"),
  ]);
  return { budgets, expenses, ious, trackers, wishlist };
}

export type LoadResult = { counts: SampleDataCounts; warnings: string[] };

/**
 * Inserts the sample dataset. Expenses are required (an error aborts);
 * budgets and trackers are best-effort and return a warning instead, since
 * some databases do not have those tables yet.
 */
export async function insertSampleData(client: SupabaseClient, userId: string): Promise<LoadResult> {
  const data = generateSampleData(new Date());
  const now = new Date().toISOString();
  const warnings: string[] = [];

  // ── Expenses ──────────────────────────────────────────────────────────────
  for (const rows of chunks(data.expenses)) {
    const { error } = await client.from("expenses").insert(
      rows.map((e) => ({
        amount: e.amount,
        categoryId: e.categoryId,
        createdAt: `${e.date}T12:00:00.000Z`,
        date: e.date,
        description: e.description,
        id: e.id,
        memberId: e.memberId,
        tagId: e.tagId,
        updatedAt: now,
        user_id: userId,
      })),
    );
    if (error) throw new Error(`Expenses could not be added: ${error.message}`);
  }

  // ── Budgets: never overwrite one the user already has ────────────────────
  try {
    const { data: existing, error } = await client
      .from("budgets")
      .select("year, month, categoryId")
      .eq("user_id", userId);
    if (error) throw error;
    const taken = new Set(
      (existing ?? []).map((b: { categoryId: string; month: number; year: number }) => `${b.year}-${b.month}-${b.categoryId}`),
    );
    const rows = data.budgets.filter((b) => !taken.has(`${b.year}-${b.month}-${b.categoryId}`));
    const skipped = data.budgets.length - rows.length;
    if (rows.length > 0) {
      const { error: insertError } = await client
        .from("budgets")
        .insert(rows.map((b) => ({ ...b, createdAt: now, updatedAt: now, user_id: userId })));
      if (insertError) throw insertError;
    }
    if (skipped > 0) {
      warnings.push(`${skipped} sample budgets were skipped because you already have a budget for that category and month.`);
    }
  } catch (error) {
    warnings.push(
      isMissingTableError(error)
        ? "Budgets are not set up in this database yet, so no sample budgets were added."
        : `Sample budgets could not be added: ${getErrorMessage(error, "unknown error")}`,
    );
  }

  // ── Trackers and their entries ────────────────────────────────────────────
  try {
    const { error } = await client.from("trackers").insert(
      data.trackers.map((t) => ({
        color: t.color,
        createdAt: t.entries[0] ? `${t.entries[0].date}T09:00:00.000Z` : now,
        currentBalance: t.currentBalance,
        description: t.description,
        id: t.id,
        initialBalance: t.initialBalance,
        title: t.title,
        updatedAt: now,
        user_id: userId,
      })),
    );
    if (error) throw error;

    const entries = data.trackers.flatMap((t) =>
      t.entries.map((e) => ({
        balance: e.balance,
        createdAt: `${e.date}T09:00:00.000Z`,
        credit: e.credit,
        date: e.date,
        debit: e.debit,
        description: e.description,
        id: e.id,
        trackerId: t.id,
        user_id: userId,
      })),
    );
    for (const rows of chunks(entries)) {
      const { error: entryError } = await client.from("trackerEntries").insert(rows);
      if (entryError) throw entryError;
    }
  } catch (error) {
    warnings.push(
      isMissingTableError(error)
        ? "Trackers are not set up in this database yet, so no sample trackers were added."
        : `Sample trackers could not be added: ${getErrorMessage(error, "unknown error")}`,
    );
  }

  // ── Lend & borrow and wishlist (need the 20261118 migration) ─────────────
  let missingMoneyTables = false;
  const { error: iouError } = await client.from("ious").insert(
    data.ious.map((i) => ({ ...i, user_id: userId })),
  );
  if (iouError) {
    if (isMissingTableError(iouError)) missingMoneyTables = true;
    else warnings.push(`Sample IOUs could not be added: ${iouError.message}`);
  }
  const { error: wishError } = await client.from("wishlist_items").insert(
    data.wishlist.map((w) => ({ ...w, user_id: userId })),
  );
  if (wishError) {
    if (isMissingTableError(wishError)) missingMoneyTables = true;
    else warnings.push(`Sample wishlist items could not be added: ${wishError.message}`);
  }
  if (missingMoneyTables) {
    warnings.push("Lend & borrow and Wishlist need the one-time setup first, so no sample IOUs or wishlist items were added.");
  }

  // ── Savings plan (needs the 20261119 migration) ──────────────────────────
  const { error: fixedError } = await client.from("fixed_costs").insert(
    data.fixedCosts.map((f) => ({ ...f, user_id: userId })),
  );
  const { error: goalError } = fixedError
    ? { error: null }
    : await client.from("savings_goals").insert(data.goals.map((g) => ({ ...g, user_id: userId })));
  const planError = fixedError ?? goalError;
  if (planError) {
    warnings.push(
      isMissingTableError(planError)
        ? "The Savings plan needs the one-time setup first, so no sample fixed costs or goals were added."
        : `Sample savings plan could not be added: ${planError.message}`,
    );
  }

  return { counts: await countSampleData(client, userId), warnings };
}

/** Deletes the caller's sample rows only. Returns how many of each were removed. */
export async function deleteSampleData(client: SupabaseClient, userId: string): Promise<SampleDataCounts> {
  const removeRange = async (table: string, column = "id", ownerColumn: string | null = "user_id") => {
    let query = client.from(table).delete({ count: "exact" }).gte(column, SAMPLE_ID_MIN).lte(column, SAMPLE_ID_MAX);
    if (ownerColumn) query = query.eq(ownerColumn, userId);
    const { count, error } = await query;
    if (error && !isMissingTableError(error)) {
      throw new Error(`Sample ${table} could not be removed: ${error.message}`);
    }
    return count ?? 0;
  };

  // Entries first — including any the user added to a sample tracker, which
  // RLS scopes to their own trackers — then the parent rows.
  await removeRange("trackerEntries", "trackerId", null).catch(() => 0);
  await removeRange("trackerEntries").catch(() => 0);
  const trackers = await removeRange("trackers").catch(() => 0);
  const ious = await removeRange("ious").catch(() => 0);
  await removeRange("fixed_costs").catch(() => 0);
  await removeRange("savings_goals").catch(() => 0);
  const wishlist = await removeRange("wishlist_items").catch(() => 0);
  const budgets = await removeRange("budgets");
  const expenses = await removeRange("expenses");

  return { budgets, expenses, ious, trackers, wishlist };
}
