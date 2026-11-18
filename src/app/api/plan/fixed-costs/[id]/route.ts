/** PATCH / DELETE /api/plan/fixed-costs/:id */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError, setupRequiredError } from "@/lib/money/server";
import { fixedCostUpdateSchema } from "@/lib/plan/schemas";
import { fixedCostFromRow } from "@/lib/plan/server";
import { apiError, apiJson, authenticate, isUuid, readJsonBody, rejectCrossSite, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That cost was not found.");
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const decision = limiter.check(auth.user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment.");

  const body = await readJsonBody(request, fixedCostUpdateSchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("fixed_costs")
    .update(body.data)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("*")
    .maybeSingle();
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(error.code === "23514" ? 400 : 500, "That change could not be saved.");
  if (!data) return apiError(404, "That cost was not found.");
  return apiJson({ fixedCost: fixedCostFromRow(data) });
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That cost was not found.");
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { count, error } = await auth.supabase
    .from("fixed_costs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(500, "That cost could not be deleted.");
  if (!count) return apiError(404, "That cost was not found.");
  return apiJson({ deleted: true });
}
