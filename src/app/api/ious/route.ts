/**
 * /api/ious — Lend & borrow.
 *
 *   GET  ?today=YYYY-MM-DD  → { ious, summary }  (or { setupRequired: true })
 *   POST                    → create an IOU      → { iou }
 *
 * Security: see src/lib/server/http.ts (auth, same-origin JSON, RLS).
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { iouCreateSchema } from "@/lib/money/schemas";
import { fetchIous, iouFromRow, isSetupError, resolveToday, setupRequiredError, setupRequiredJson } from "@/lib/money/server";
import { summarizeIous } from "@/lib/money/summary";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const writeLimiter = createRateLimiter({ limit: 120, minIntervalMs: 150, windowMs: 10 * 60_000 });

export async function GET(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  try {
    const ious = await fetchIous(auth.supabase, auth.user.id);
    return apiJson({ ious, summary: summarizeIous(ious, resolveToday(request)) });
  } catch (error) {
    if (isSetupError(error)) return setupRequiredJson();
    return apiError(500, "Your IOUs could not be loaded. Please try again.");
  }
}

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = writeLimiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You're adding entries too quickly. Please wait a moment.");

  const body = await readJsonBody(request, iouCreateSchema);
  if ("response" in body) return body.response;
  const input = body.data;

  const { data, error } = await supabase
    .from("ious")
    .insert({
      amount: input.amount,
      date: input.date,
      description: input.description ?? null,
      direction: input.direction,
      dueDate: input.dueDate ?? null,
      person: input.person,
      user_id: user.id,
    })
    .select("*")
    .single();

  if (error) {
    if (isSetupError(error)) return setupRequiredError();
    return apiError(error.code === "23514" ? 400 : 500, "That entry could not be saved. Please check it and try again.");
  }
  return apiJson({ iou: iouFromRow(data) }, 201);
}
