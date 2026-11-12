/**
 * src/lib/insights/generate.ts
 *
 * Feature 7: orchestrates one insights request.
 *
 *   user's own rows ──► buildInsightsSummary (TypeScript, exact)
 *                          │
 *                          ├─ no spending ─────────────────► "no data" result
 *                          ▼
 *                     buildInsightsMessages ──► callAI (Pollinations)
 *                          │                         │ failure / timeout / 429
 *                          ▼                         ▼
 *                     parseInsightsContent ──► deterministic fallback
 *                     (shape + grounding)        (always available)
 *
 * The AI call is injected, so every path is unit-testable without network.
 */

import type { InsightsResponse } from "@/entities/Insights";
import type { AnalyticsBudget, AnalyticsExpense } from "@/lib/analytics";

import { buildFallbackHeadline, buildFallbackInsights } from "./fallback";
import { parseInsightsContent } from "./parse";
import type { PollinationsResult } from "./pollinations";
import { buildInsightsMessages, type ChatMessage } from "./prompt";
import { buildInsightsSummary } from "./summary";

export type GenerateInsightsInput = {
  expenses: readonly AnalyticsExpense[];
  budgets: readonly AnalyticsBudget[] | null;
  year: number;
  month: number; // 1-12
  today: Date;
  nameOf: (key: string) => string;
  callAI: (messages: ChatMessage[]) => Promise<PollinationsResult>;
};

export async function generateInsights(input: GenerateInsightsInput): Promise<InsightsResponse> {
  const summary = buildInsightsSummary(input);
  const generatedAt = input.today.toISOString();

  const fallback = (reason: InsightsResponse["fallbackReason"]): InsightsResponse => ({
    fallbackReason: reason,
    generatedAt,
    headline: buildFallbackHeadline(summary),
    insights: buildFallbackInsights(summary),
    source: "fallback",
    summary,
  });

  // Nothing to analyse: don't spend an AI call on an empty month.
  if (summary.totals.transactions === 0) return fallback("no_data");

  const ai = await input.callAI(buildInsightsMessages(summary));
  if (!ai.ok) return fallback(ai.reason);

  const parsed = parseInsightsContent(ai.content, summary);
  if (!parsed.ok) return fallback(parsed.reason);

  return {
    droppedInsights: parsed.dropped,
    generatedAt,
    headline: parsed.headline ?? buildFallbackHeadline(summary),
    insights: parsed.insights,
    model: ai.model,
    source: "ai",
    summary,
  };
}
