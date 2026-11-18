/**
 * GET /api/profile/stats — summary figures for the profile page.
 *
 * Uses the profile_stats() SQL function (one round-trip, runs with the
 * caller's RLS). If the migration has not been applied yet, falls back to
 * individual queries with the same result shape.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileStats } from "@/lib/profile/schemas";
import { apiError, apiJson, authenticate } from "@/lib/profile/server";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pad = (n: number) => String(n).padStart(2, "0");
const sumPence = (values: number[]) => values.reduce((s, v) => s + Math.round(v * 100), 0) / 100;

async function fallbackStats(supabase: SupabaseClient, userId: string): Promise<ProfileStats> {
  const now = new Date();
  const year = now.getFullYear();
  const monthKey = `${year}-${pad(now.getMonth() + 1)}`;
  const head = { count: "exact" as const, head: true };

  const [expenses, budgets, trackers, first, yearRows] = await Promise.all([
    supabase.from("expenses").select("id", head).eq("user_id", userId),
    supabase.from("budgets").select("id", head).eq("user_id", userId),
    supabase.from("trackers").select("id", head).eq("user_id", userId),
    supabase.from("expenses").select("date").eq("user_id", userId).order("date", { ascending: true }).limit(1),
    fetchExpenseRowsBetween(supabase, userId, `${year}-01-01`, `${year}-12-31`, "amount,date"),
  ]);
  if (expenses.error) throw expenses.error;

  const amounts = yearRows.map((r) => ({ amount: Number(r.amount), date: String(r.date) }));
  return {
    budgets: budgets.error ? null : (budgets.count ?? 0),
    expenses: expenses.count ?? 0,
    firstExpenseDate: (first.data?.[0]?.date as string | undefined) ?? null,
    source: "fallback",
    spentThisMonth: sumPence(amounts.filter((r) => r.date.startsWith(monthKey)).map((r) => r.amount)),
    spentThisYear: sumPence(amounts.map((r) => r.amount)),
    trackers: trackers.error ? null : (trackers.count ?? 0),
  };
}

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const { data, error } = await supabase.rpc("profile_stats");
  if (!error && data) {
    const stats: ProfileStats = {
      budgets: data.budgets === undefined ? null : Number(data.budgets),
      expenses: Number(data.expenses ?? 0),
      firstExpenseDate: data.firstExpenseDate ?? null,
      source: "rpc",
      spentThisMonth: Number(data.spentThisMonth ?? 0),
      spentThisYear: Number(data.spentThisYear ?? 0),
      trackers: data.trackers === undefined ? null : Number(data.trackers),
    };
    return apiJson(stats);
  }

  try {
    return apiJson(await fallbackStats(supabase, user.id));
  } catch {
    return apiError(500, "Your figures could not be loaded. Please try again.");
  }
}
