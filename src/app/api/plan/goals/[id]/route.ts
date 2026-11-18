/**
 * PATCH /api/plan/goals/:id  { action: "edit", … } | { action: "contribute", amount }
 * DELETE /api/plan/goals/:id
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError, setupRequiredError } from "@/lib/money/server";
import { goalUpdateSchema } from "@/lib/plan/schemas";
import { goalFromRow } from "@/lib/plan/server";
import { apiError, apiJson, authenticate, isUuid, readJsonBody, rejectCrossSite, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });
type Context = { params: Promise<{ id: string }> };
const pence = (v: number) => Math.round(v * 100);

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That goal was not found.");
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;
  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment.");

  const body = await readJsonBody(request, goalUpdateSchema);
  if ("response" in body) return body.response;
  const update = body.data;

  const { data: row, error: readError } = await supabase
    .from("savings_goals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return isSetupError(readError) ? setupRequiredError() : apiError(500, "Please try again.");
  if (!row) return apiError(404, "That goal was not found.");
  const goal = goalFromRow(row);

  let changes: Record<string, unknown>;
  if (update.action === "contribute") {
    const next = Math.max(0, pence(goal.savedAmount) + pence(update.amount));
    changes = { savedAmount: next / 100 };
  } else {
    const { action: _action, ...fields } = update;
    changes = { ...fields };
  }

  const { data, error } = await supabase
    .from("savings_goals")
    .update(changes)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(error.code === "23514" ? 400 : 500, "That change could not be saved.");
  return apiJson({ goal: goalFromRow(data) });
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That goal was not found.");
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { count, error } = await auth.supabase
    .from("savings_goals")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(500, "That goal could not be deleted.");
  if (!count) return apiError(404, "That goal was not found.");
  return apiJson({ deleted: true });
}
