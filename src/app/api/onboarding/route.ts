/**
 * POST /api/onboarding — first-run setup.
 *
 *   { action: "complete", answers }  → saves the answers and marks setup done
 *   { action: "skip" }               → marks setup skipped (no questions again)
 *
 * "complete" sets up the account from the questionnaire: name, salary and
 * monthly savings goal (profile), rent and bills (savings plan), a savings
 * goal, and optionally example data. Re-running it never duplicates: fixed
 * costs and goals that already exist (same name) are skipped. Parts whose
 * tables are not created yet are reported as warnings, not errors.
 */

import { z } from "zod";

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError } from "@/lib/money/server";
import { onboardingSchema, type OnboardingState } from "@/lib/onboarding/schemas";
import { logActivity, saveProfile } from "@/lib/profile/server";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";
import { countSampleData, insertSampleData } from "@/lib/supabase/sampleData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 10, minIntervalMs: 2_000, windowMs: 10 * 60_000 });

const bodySchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("complete"), answers: onboardingSchema }),
  z.strictObject({ action: z.literal("skip") }),
]);

const PLAN_SETUP_WARNING =
  "Your rent, bills and goal need the one-time database setup before they can be saved — open Savings plan and follow “Finish setup”, then add them there.";

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment and try again.");

  const body = await readJsonBody(request, bodySchema, 8192);
  if ("response" in body) return body.response;

  const markDone = async (state: OnboardingState) => {
    const { error } = await supabase.auth.updateUser({ data: { onboarding: state } });
    return !error;
  };

  if (body.data.action === "skip") {
    const ok = await markDone({ skippedAt: new Date().toISOString() });
    return ok ? apiJson({ skipped: true }) : apiError(500, "Please try again.");
  }

  const answers = body.data.answers;
  const warnings: string[] = [];

  // 1. Profile: name, salary, savings goal (only what was answered).
  const saved = await saveProfile(supabase, user, {
    fullName: answers.fullName,
    ...(answers.monthlyIncome !== null && { monthlyIncome: answers.monthlyIncome }),
    ...(answers.monthlySavingsGoal !== null && { monthlySavingsGoal: answers.monthlySavingsGoal }),
  });
  if (!saved.ok) {
    if (!saved.setupRequired) return apiError(saved.status, saved.message);
    // Savings goal column missing: keep the rest.
    const retry = await saveProfile(supabase, user, {
      fullName: answers.fullName,
      ...(answers.monthlyIncome !== null && { monthlyIncome: answers.monthlyIncome }),
    });
    if (!retry.ok) return apiError(retry.status, retry.message);
    warnings.push("Your monthly savings goal needs the one-time database setup — set it again in Savings plan afterwards.");
  }

  // 2. Fixed costs (rent, bills) — skip names that already exist.
  let fixedAdded = 0;
  let planMissing = false;
  if (answers.fixedCosts.length > 0) {
    const existing = await supabase.from("fixed_costs").select("name").eq("user_id", user.id);
    if (existing.error) {
      if (isSetupError(existing.error)) planMissing = true;
      else warnings.push("Your fixed costs could not be saved — add them in Savings plan.");
    } else {
      const taken = new Set((existing.data ?? []).map((r: { name: string }) => r.name.trim().toLowerCase()));
      const rows = answers.fixedCosts
        .filter((f) => !taken.has(f.name.trim().toLowerCase()))
        .map((f) => ({ amount: f.amount, name: f.name.trim(), user_id: user.id }));
      if (rows.length > 0) {
        const { error } = await supabase.from("fixed_costs").insert(rows);
        if (error) warnings.push("Your fixed costs could not be saved — add them in Savings plan.");
        else fixedAdded = rows.length;
      }
    }
  }

  // 3. Savings goal — skip if one with the same name exists.
  let goalAdded = false;
  if (answers.goal && !planMissing) {
    const existing = await supabase.from("savings_goals").select("name").eq("user_id", user.id);
    if (existing.error) {
      if (isSetupError(existing.error)) planMissing = true;
      else warnings.push("Your savings goal could not be saved — add it in Savings plan.");
    } else if (!(existing.data ?? []).some((g: { name: string }) => g.name.trim().toLowerCase() === answers.goal!.name.trim().toLowerCase())) {
      const { error } = await supabase.from("savings_goals").insert({
        name: answers.goal.name.trim(),
        targetAmount: answers.goal.targetAmount,
        targetDate: answers.goal.targetDate,
        user_id: user.id,
      });
      if (error) warnings.push("Your savings goal could not be saved — add it in Savings plan.");
      else goalAdded = true;
    }
  }
  if (planMissing) warnings.push(PLAN_SETUP_WARNING);

  // 4. Example data, if asked for and not already there.
  let sampleLoaded = false;
  if (answers.loadSampleData) {
    try {
      const counts = await countSampleData(supabase, user.id);
      if (counts.expenses + counts.budgets + counts.trackers + counts.ious + counts.wishlist === 0) {
        const result = await insertSampleData(supabase, user.id);
        warnings.push(...result.warnings);
        sampleLoaded = true;
      }
    } catch {
      warnings.push("Example data could not be loaded — try again from Profile → Data.");
    }
  }

  // 5. Done.
  await markDone({ completedAt: new Date().toISOString(), interests: answers.interests });
  await logActivity(supabase, user.id, "profile_updated", { detail: "Completed first-run setup", request });

  return apiJson({ fixedCostsAdded: fixedAdded, goalAdded, sampleLoaded, warnings });
}
