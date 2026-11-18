/**
 * GET /api/plan?today=YYYY-MM-DD — the Savings plan: salary, fixed costs,
 * goals, the last six months' savings and the computed plan.
 * Returns { setupRequired: true } until the plan tables exist.
 */

import { resolveToday } from "@/lib/money/server";
import { loadPlan } from "@/lib/plan/server";
import { apiError, apiJson, authenticate } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  try {
    return apiJson(await loadPlan(auth.supabase, auth.user, resolveToday(request)));
  } catch {
    return apiError(500, "Your savings plan could not be loaded. Please try again.");
  }
}
