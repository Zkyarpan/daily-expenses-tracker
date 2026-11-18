/**
 * /api/ious/:id
 *
 *   PATCH  { action: "edit", …fields }   change details
 *          { action: "payment", amount }  record a (partial) repayment
 *          { action: "settle" }           mark fully repaid
 *          { action: "reopen" }           mark as not repaid
 *   DELETE                                remove the entry
 *
 * `settledAt` is kept in step with `paidAmount` by a database trigger, so a
 * fully repaid IOU is always marked settled.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { iouUpdateSchema } from "@/lib/money/schemas";
import { iouFromRow, isSetupError, setupRequiredError } from "@/lib/money/server";
import {
  apiError,
  apiJson,
  authenticate,
  isUuid,
  readJsonBody,
  rejectCrossSite,
  tooManyRequests,
} from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const writeLimiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });

type Context = { params: Promise<{ id: string }> };

const pence = (v: number) => Math.round(v * 100);

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That entry was not found.");

  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = writeLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You're making changes too quickly. Please wait a moment.");

  const body = await readJsonBody(request, iouUpdateSchema);
  if ("response" in body) return body.response;
  const update = body.data;

  const { data: row, error: readError } = await supabase
    .from("ious")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return isSetupError(readError) ? setupRequiredError() : apiError(500, "Please try again.");
  if (!row) return apiError(404, "That entry was not found.");
  const current = iouFromRow(row);

  let changes: Record<string, unknown>;
  switch (update.action) {
    case "payment": {
      const remaining = pence(current.amount) - pence(current.paidAmount);
      if (remaining <= 0) return apiError(400, "This is already fully repaid.");
      if (pence(update.amount) > remaining) {
        return apiError(400, `That's more than the ${(remaining / 100).toFixed(2)} still owed.`, { field: "amount" });
      }
      changes = { paidAmount: (pence(current.paidAmount) + pence(update.amount)) / 100 };
      break;
    }
    case "settle":
      changes = { paidAmount: current.amount };
      break;
    case "reopen":
      changes = { paidAmount: 0 };
      break;
    case "edit": {
      const { action: _action, ...fields } = update;
      changes = { ...fields };
      // Lowering the amount below what was repaid settles it at the new amount.
      const amount = fields.amount ?? current.amount;
      if (pence(current.paidAmount) > pence(amount)) changes.paidAmount = amount;
      break;
    }
  }

  const { data, error } = await supabase
    .from("ious")
    .update(changes)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) {
    if (isSetupError(error)) return setupRequiredError();
    return apiError(error.code === "23514" ? 400 : 500, "That change could not be saved. Please try again.");
  }
  return apiJson({ iou: iouFromRow(data) });
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That entry was not found.");

  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { count, error } = await auth.supabase
    .from("ious")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(500, "That entry could not be deleted.");
  if (!count) return apiError(404, "That entry was not found.");
  return apiJson({ deleted: true });
}
