/**
 * /api/profile/sample-data — realistic test data for the signed-in user.
 *
 *   GET     → { counts }               sample rows currently in the account
 *   POST    → { counts, warnings }     load the dataset (409 if already loaded)
 *   DELETE  → { removed }              remove sample rows only
 *
 * Sample rows are identified by a reserved id range (src/lib/sampleData.ts);
 * the user's own records are never matched.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import type { SampleDataCounts } from "@/lib/profile/schemas";
import { apiError, apiJson, authenticate, logActivity, rejectCrossSite, tooManyRequests } from "@/lib/profile/server";
import { countSampleData, deleteSampleData, insertSampleData } from "@/lib/supabase/sampleData";
import { getErrorMessage } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loading writes ~750 rows: 4 per 10 minutes, 10 s apart (load + remove share it). */
const limiter = createRateLimiter({ limit: 4, minIntervalMs: 10_000, windowMs: 10 * 60_000 });

const total = (c: SampleDataCounts) => c.expenses + c.budgets + c.trackers + c.ious + c.wishlist;

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  return apiJson({ counts: await countSampleData(auth.supabase, auth.user.id) });
}

export async function POST(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment before changing sample data again.");

  if (total(await countSampleData(supabase, user.id)) > 0) {
    return apiError(409, "Sample data is already loaded. Remove it first to load a fresh copy.");
  }

  try {
    const result = await insertSampleData(supabase, user.id);
    await logActivity(supabase, user.id, "sample_data_loaded", {
      detail: `${result.counts.expenses} expenses, ${result.counts.budgets} budgets, ${result.counts.trackers} trackers, ${result.counts.ious} IOUs, ${result.counts.wishlist} wishlist items`,
      request,
    });
    return apiJson(result, 201);
  } catch (error) {
    return apiError(500, getErrorMessage(error, "Sample data could not be loaded. Please try again."));
  }
}

export async function DELETE(request: Request) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment before changing sample data again.");

  try {
    const removed = await deleteSampleData(supabase, user.id);
    await logActivity(supabase, user.id, "sample_data_removed", {
      detail: `${removed.expenses} expenses, ${removed.budgets} budgets, ${removed.trackers} trackers, ${removed.ious} IOUs, ${removed.wishlist} wishlist items`,
      request,
    });
    return apiJson({ removed });
  } catch (error) {
    return apiError(500, getErrorMessage(error, "Sample data could not be removed. Please try again."));
  }
}
