/**
 * GET /api/money/overview?today=YYYY-MM-DD
 *
 * Everything for "Your money at a glance" in one call: this month's savings
 * (income − spending, goal, safe-to-spend), who owes who, and the wishlist.
 * `today` is the browser's local date so "this month" matches the user.
 *
 * Savings work without the newer tables; IOU and wishlist parts are null
 * (with setupRequired = true) until the migration is applied.
 */

import type { MoneyOverview } from "@/lib/money/schemas";
import { fetchIous, fetchWishlist, isSetupError, resolveToday } from "@/lib/money/server";
import { monthSavings, sortWishlist, summarizeIous, summarizeWishlist } from "@/lib/money/summary";
import { readProfile } from "@/lib/profile/server";
import { apiError, apiJson, authenticate } from "@/lib/server/http";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const today = resolveToday(request);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const monthEnd = `${today.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;

  try {
    const [{ profile }, rows, ious, wishlist] = await Promise.all([
      readProfile(supabase, user),
      fetchExpenseRowsBetween(supabase, user.id, monthStart, monthEnd, "amount"),
      fetchIous(supabase, user.id).catch((error) => (isSetupError(error) ? null : Promise.reject(error))),
      fetchWishlist(supabase, user.id).catch((error) => (isSetupError(error) ? null : Promise.reject(error))),
    ]);

    const spent = rows.reduce((sum: number, r: { amount: unknown }) => sum + Math.round(Number(r.amount) * 100), 0) / 100;
    const sorted = wishlist ? sortWishlist(wishlist) : null;

    const overview: MoneyOverview = {
      ious: ious ? summarizeIous(ious, today) : null,
      savings: monthSavings({ goal: profile.monthlySavingsGoal, income: profile.monthlyIncome, spent, today }),
      setupRequired: ious === null || wishlist === null,
      wishlist: sorted
        ? { ...summarizeWishlist(sorted), nextUp: sorted.find((item) => !item.purchasedAt) ?? null }
        : null,
    };
    return apiJson(overview);
  } catch {
    return apiError(500, "Your overview could not be loaded. Please try again.");
  }
}
