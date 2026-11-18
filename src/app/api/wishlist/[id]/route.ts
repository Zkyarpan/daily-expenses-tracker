/**
 * /api/wishlist/:id
 *
 *   PATCH  { action: "edit", …fields }               change details
 *          { action: "save", amount }                 set money aside (negative = take back)
 *          { action: "buy", paid, date, addExpense }  mark bought (optionally log an expense)
 *          { action: "restore" }                      back on the list (removes that expense)
 *   DELETE                                            remove the item (any expense stays)
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { wishlistUpdateSchema } from "@/lib/money/schemas";
import { isSetupError, setupRequiredError, wishlistFromRow } from "@/lib/money/server";
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
  if (!isUuid(id)) return apiError(404, "That item was not found.");

  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = writeLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You're making changes too quickly. Please wait a moment.");

  const body = await readJsonBody(request, wishlistUpdateSchema);
  if ("response" in body) return body.response;
  const update = body.data;

  const { data: row, error: readError } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return isSetupError(readError) ? setupRequiredError() : apiError(500, "Please try again.");
  if (!row) return apiError(404, "That item was not found.");
  const item = wishlistFromRow(row);

  let changes: Record<string, unknown>;
  let expenseId: string | null = null;

  switch (update.action) {
    case "edit": {
      const { action: _action, ...fields } = update;
      changes = { ...fields };
      const price = fields.price ?? item.price;
      if (pence(item.savedAmount) > pence(price)) changes.savedAmount = price;
      break;
    }
    case "save": {
      if (item.purchasedAt) return apiError(400, "This item is already bought.");
      const next = Math.min(Math.max(pence(item.savedAmount) + pence(update.amount), 0), pence(item.price));
      changes = { savedAmount: next / 100 };
      break;
    }
    case "buy": {
      if (item.purchasedAt) return apiError(400, "This item is already marked as bought.");
      changes = { purchasedAt: update.date, savedAmount: Math.min(item.savedAmount, update.paid) };
      if (update.addExpense) {
        expenseId = crypto.randomUUID();
        const now = new Date().toISOString();
        const { error: expenseError } = await supabase.from("expenses").insert({
          amount: update.paid,
          categoryId: item.categoryId,
          createdAt: now,
          date: update.date,
          description: item.name,
          id: expenseId,
          memberId: null,
          tagId: null,
          updatedAt: now,
          user_id: user.id,
        });
        if (expenseError) return apiError(500, "The purchase could not be recorded as an expense. Nothing was changed.");
        changes.expenseId = expenseId;
      }
      break;
    }
    case "restore": {
      changes = { expenseId: null, purchasedAt: null };
      break;
    }
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .update(changes)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    // Keep things consistent: undo the expense we just created.
    if (expenseId) await supabase.from("expenses").delete().eq("id", expenseId).eq("user_id", user.id);
    if (isSetupError(error)) return setupRequiredError();
    return apiError(error.code === "23514" ? 400 : 500, "That change could not be saved. Please try again.");
  }

  // Restoring removes the expense that "buy" recorded (only that one).
  if (update.action === "restore" && item.expenseId) {
    await supabase.from("expenses").delete().eq("id", item.expenseId).eq("user_id", user.id);
  }

  return apiJson({ expenseCreated: !!expenseId, item: wishlistFromRow(data) });
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;
  const { id } = await params;
  if (!isUuid(id)) return apiError(404, "That item was not found.");

  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { count, error } = await auth.supabase
    .from("wishlist_items")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return isSetupError(error) ? setupRequiredError() : apiError(500, "That item could not be deleted.");
  if (!count) return apiError(404, "That item was not found.");
  return apiJson({ deleted: true });
}
