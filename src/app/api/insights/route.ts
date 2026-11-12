/**
 * POST /api/insights — Feature 7: AI-Powered Spending Insights.
 *
 * Security
 *  - Authentication is checked HERE: the middleware lets /api/* through
 *    without a session check, so this handler must not rely on it.
 *  - Data is read with the caller's own cookie session, so Supabase RLS
 *    (user_id = auth.uid()) applies, plus an explicit user_id filter. The
 *    client only chooses the month; it never sends figures, so it cannot
 *    analyse someone else's data or inject numbers.
 *  - Data minimisation: only id, amount, categoryId and date are read; no
 *    descriptions, tags or member fields leave the database.
 *  - POLLINATIONS_API_KEY is read from the server environment only and never
 *    returned or logged.
 *  - JSON-only requests (blocks simple cross-site form posts); tiny body cap.
 *  - Per-user rate limit; responses are never cached by browsers.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import type { InsightsResponse } from "@/entities/Insights";
import type { AnalyticsBudget } from "@/lib/analytics";
import { categoryNameOf } from "@/lib/categoryNames";
import { generateInsights } from "@/lib/insights/generate";
import { callPollinations, DEFAULT_MODEL } from "@/lib/insights/pollinations";
import { createRateLimiter } from "@/lib/insights/rateLimit";
import { buildInsightsSummary, insightsDateRange } from "@/lib/insights/summary";
import { fetchExpenseRowsBetween, isMissingTableError } from "@/lib/supabase/queries";
import { createServerClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** 1 request per 15 s and 5 per 10 min, per user. */
const limiter = createRateLimiter({ limit: 5, minIntervalMs: 15_000, windowMs: 10 * 60_000 });

/** Same user + month + identical figures → reuse the answer for 10 minutes. */
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { expires: number; response: InsightsResponse }>();

const bodySchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const error = (status: number, message: string, headers: Record<string, string> = {}) =>
  NextResponse.json({ error: message }, { headers: { ...NO_STORE, ...headers }, status });

export async function POST(request: Request) {
  // ── Request shape ─────────────────────────────────────────────────────────
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return error(415, "Requests must be JSON.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > 1024) {
    return error(413, "Request is too large.");
  }

  // ── Authentication ───────────────────────────────────────────────────────
  const supabase = await createServerClient();
  if (!supabase) return error(503, "AI insights need a signed-in account (Supabase is not configured).");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return error(401, "Please sign in to generate insights.");

  // ── Input ────────────────────────────────────────────────────────────────
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return error(400, "Choose a valid month and year.");
  }

  // ── Rate limit (per user) ────────────────────────────────────────────────
  const decision = limiter.check(user.id);
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error:
          decision.reason === "too_soon"
            ? "Please wait a few seconds before generating insights again."
            : "You've reached the limit of 5 insight requests in 10 minutes.",
        retryAfterSeconds: decision.retryAfterSeconds,
      },
      { headers: { ...NO_STORE, "Retry-After": String(decision.retryAfterSeconds) }, status: 429 },
    );
  }

  // ── Load the user's own data (RLS + explicit filter, minimal columns) ────
  const { end, start } = insightsDateRange(body.year, body.month);
  let expenses;
  try {
    expenses = await fetchExpenseRowsBetween(supabase, user.id, dateKey(start), dateKey(end), "id,amount,categoryId,date");
  } catch {
    return error(500, "Your expenses could not be loaded. Please try again.");
  }

  let budgets: AnalyticsBudget[] | null = null;
  const budgetResult = await supabase
    .from("budgets")
    .select("year,month,categoryId,limitAmount")
    .eq("user_id", user.id)
    .eq("year", body.year)
    .eq("month", body.month);
  if (!budgetResult.error) {
    budgets = (budgetResult.data ?? []).map((b) => ({
      categoryId: String(b.categoryId),
      limitAmount: Number(b.limitAmount),
      month: Number(b.month),
      year: Number(b.year),
    }));
  } else if (!isMissingTableError(budgetResult.error)) {
    console.warn("[insights] budgets unavailable:", budgetResult.error.code);
  }

  const rows = expenses.map((e) => ({
    amount: Number(e.amount),
    categoryId: e.categoryId ?? null,
    date: String(e.date),
    id: String(e.id),
  }));
  const today = new Date();
  const input = { budgets, expenses: rows, month: body.month, nameOf: categoryNameOf, today, year: body.year };

  // ── Cache: identical figures for the same user/month → same answer ──────
  const cacheKey = `${user.id}:${body.year}-${body.month}:${JSON.stringify(buildInsightsSummary(input))}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) {
    return NextResponse.json({ ...hit.response, cached: true }, { headers: NO_STORE });
  }

  // ── Generate (AI with deterministic fallback) ────────────────────────────
  const model = process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL;
  const response = await generateInsights({
    ...input,
    callAI: async (messages) => {
      const result = await callPollinations({ apiKey: process.env.POLLINATIONS_API_KEY, messages, model });
      if (!result.ok) console.warn("[insights] AI unavailable:", result.reason, result.status ?? "", result.message);
      return result;
    },
  });

  // Cache real AI answers only, so a transient failure is retried next time.
  if (response.source === "ai") {
    if (cache.size > 500) cache.clear();
    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, response });
  }

  return NextResponse.json(response, { headers: NO_STORE });
}
