/** POST /api/plan/fixed-costs — add a monthly fixed cost (rent, phone…). */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError, setupRequiredError } from "@/lib/money/server";
import { fixedCostCreateSchema } from "@/lib/plan/schemas";
import { fixedCostFromRow } from "@/lib/plan/server";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const decision = limiter.check(auth.user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment.");

  const body = await readJsonBody(request, fixedCostCreateSchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("fixed_costs")
    .insert({ ...body.data, dueDay: body.data.dueDay ?? null, user_id: auth.user.id })
    .select("*")
    .single();
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(error.code === "23514" ? 400 : 500, "That cost could not be saved.");
  return apiJson({ fixedCost: fixedCostFromRow(data) }, 201);
}
