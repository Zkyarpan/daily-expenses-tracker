/**
 * /api/wishlist — things the user wants to buy.
 *
 *   GET   → { items, summary }   (or { setupRequired: true })
 *   POST  → add an item          → { item }
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { wishlistCreateSchema } from "@/lib/money/schemas";
import { fetchWishlist, isSetupError, setupRequiredError, setupRequiredJson, wishlistFromRow } from "@/lib/money/server";
import { sortWishlist, summarizeWishlist } from "@/lib/money/summary";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const writeLimiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  try {
    const items = sortWishlist(await fetchWishlist(auth.supabase, auth.user.id));
    return apiJson({ items, summary: summarizeWishlist(items) });
  } catch (error) {
    if (isSetupError(error)) return setupRequiredJson();
    return apiError(500, "Your wishlist could not be loaded. Please try again.");
  }
}

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = writeLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You're adding items too quickly. Please wait a moment.");

  const body = await readJsonBody(request, wishlistCreateSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({
      categoryId: input.categoryId ?? "4",
      name: input.name,
      notes: input.notes ?? null,
      price: input.price,
      priority: input.priority,
      // Never more set aside than the price.
      savedAmount: Math.min(input.savedAmount ?? 0, input.price),
      targetDate: input.targetDate ?? null,
      url: input.url ?? null,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    if (isSetupError(error)) return setupRequiredError();
    return apiError(error.code === "23514" ? 400 : 500, "That item could not be saved. Please check it and try again.");
  }
  return apiJson({ item: wishlistFromRow(data) }, 201);
}
