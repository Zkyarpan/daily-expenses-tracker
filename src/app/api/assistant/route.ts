/**
 * POST /api/assistant — answer a question about the user's own money.
 *
 *   body: { question, previousQuestion?, context? }  →  { answer, understoodBy }
 *
 * How it stays accurate and private
 *  1. The question is turned into a structured query — by the AI when it is
 *     configured (only the question text is sent, never any figures), or by
 *     the rule-based parser otherwise / if the AI fails.
 *  2. The query runs against the user's data with their own session (RLS).
 *  3. The reply is built from that data in code (src/lib/assistant/answer.ts);
 *     the AI never writes numbers, so it cannot make them up.
 */

import { z } from "zod";

import { activeProvider, callAI } from "@/lib/ai/provider";
import { buildQueryMessages, parseAiQuery } from "@/lib/assistant/ai";
import { applyContext, contextSchema, parseQuestion } from "@/lib/assistant/query";
import { runAssistantQuery } from "@/lib/assistant/server";
import { createRateLimiter } from "@/lib/insights/rateLimit";
import { resolveToday } from "@/lib/money/server";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 40 questions per 10 minutes, at least 0.5 s apart. */
const limiter = createRateLimiter({ limit: 40, minIntervalMs: 500, windowMs: 10 * 60_000 });

const bodySchema = z.strictObject({
  context: contextSchema.optional(),
  previousQuestion: z.string().trim().max(300).nullish(),
  question: z.string().trim().min(1, "Ask a question.").max(300, "Keep questions under 300 characters."),
});

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You’re asking quickly — please wait a moment.");

  const body = await readJsonBody(request, bodySchema, 4096);
  if ("response" in body) return body.response;
  const { previousQuestion, question } = body.data;
  const context = body.data.context ?? {};
  const today = resolveToday(request);

  // 1. Understand the question.
  let understoodBy: "ai" | "rules" = "rules";
  let query = parseQuestion(question, today, context);
  if (activeProvider()) {
    const result = await callAI({
      maxCompletionTokens: 300,
      messages: buildQueryMessages(question, previousQuestion ?? null, today),
      timeoutMs: 8_000,
    });
    const aiQuery = result.ok ? parseAiQuery(result.content) : null;
    // Prefer the AI's reading, but keep a concrete subject the rules found if the AI missed it.
    if (aiQuery) {
      understoodBy = "ai";
      query = {
        ...aiQuery,
        categoryId: aiQuery.categoryId ?? (aiQuery.intent === query.intent ? query.categoryId : null),
        search: aiQuery.search ?? (aiQuery.intent === query.intent && !aiQuery.categoryId ? query.search : null),
      };
    }
  }
  query = applyContext(query, context);

  // 2–3. Answer from the user's data.
  try {
    const answer = await runAssistantQuery({ query, supabase, today, user });
    return apiJson({ answer, understoodBy });
  } catch (error) {
    console.warn("[assistant] failed:", (error as { code?: string })?.code ?? "error");
    return apiError(500, "I couldn’t look that up just now. Please try again.");
  }
}
