/** POST /api/plan/goals — add a savings goal. */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError, setupRequiredError } from "@/lib/money/server";
import { goalCreateSchema } from "@/lib/plan/schemas";
import { goalFromRow } from "@/lib/plan/server";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const decision = limiter.check(auth.user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment.");

  const body = await readJsonBody(request, goalCreateSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  const { data, error } = await auth.supabase
    .from("savings_goals")
    .insert({
      name: input.name,
      savedAmount: Math.min(input.savedAmount ?? 0, input.targetAmount),
      targetAmount: input.targetAmount,
      targetDate: input.targetDate ?? null,
      user_id: auth.user.id,
    })
    .select("*")
    .single();
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(error.code === "23514" ? 400 : 500, "That goal could not be saved.");
  return apiJson({ goal: goalFromRow(data) }, 201);
}
