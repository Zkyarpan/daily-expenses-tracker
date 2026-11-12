/**
 * src/entities/Insights.ts
 *
 * Types for Feature 7: AI-Powered Spending Insights.
 *
 * InsightsSummary is the ONLY data sent to the AI provider. It holds
 * aggregated figures and fixed category names from the app's config. It
 * deliberately has no fields for expense IDs, descriptions, merchants/tags,
 * member names, emails, user IDs or individual transaction dates.
 */

export type InsightKind = "risk" | "saving" | "trend" | "positive";

export type Insight = {
  kind: InsightKind;
  title: string;
  detail: string;
};

export type BudgetRisk = "under" | "warning" | "critical" | "over";

export type InsightsSummary = {
  currency: "GBP";
  period: {
    /** e.g. "November 2026" */
    label: string;
    year: number;
    /** 1-based: 1 = January */
    month: number;
    isCurrentMonth: boolean;
    daysElapsed: number;
    daysInMonth: number;
  };
  totals: {
    spending: number;
    transactions: number;
    averageTransaction: number;
    previousMonthSpending: number;
    changeVsPreviousMonth: number;
    /** null when the previous month had no spending */
    changeVsPreviousMonthPct: number | null;
    /** Average of the previous months in `monthlyTrend` that had spending; null if none. */
    priorMonthsAverage: number | null;
    /** Straight-line projection for the current month only; null otherwise. */
    projectedMonthEnd: number | null;
  };
  /** Oldest first, ending with the selected month. */
  monthlyTrend: Array<{ month: string; total: number }>;
  categories: Array<{
    category: string;
    total: number;
    sharePct: number;
    transactions: number;
    previousMonthTotal: number;
    changePct: number | null;
  }>;
  /** null when budgets are unavailable (table missing / not loaded). */
  budgets: null | {
    totalLimit: number;
    totalSpent: number;
    utilisationPct: number | null;
    rows: Array<{
      category: string;
      limit: number;
      spent: number;
      remaining: number;
      utilisationPct: number;
      status: BudgetRisk;
      /** Current month only: straight-line projection of month-end spend. */
      projectedSpend: number | null;
    }>;
  };
  /** Pre-calculated, so the AI never has to invent savings figures. */
  savingsOpportunities: Array<{ action: string; amount: number; reductionPct: number | null }>;
  thresholds: { warningPct: number; limitPct: number };
};

export type InsightsFallbackReason =
  | "not_configured"
  | "unauthorized"
  | "insufficient_balance"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "blocked"
  | "bad_response"
  | "ungrounded"
  | "no_data";

export type InsightsResponse = {
  source: "ai" | "fallback";
  headline: string;
  insights: Insight[];
  summary: InsightsSummary;
  generatedAt: string;
  /** AI model used (source "ai" only). */
  model?: string;
  /** Why the deterministic summary was used (source "fallback" only). */
  fallbackReason?: InsightsFallbackReason;
  /** AI insights removed because they quoted figures not in the summary. */
  droppedInsights?: number;
  /** True when served from the short-lived server cache. */
  cached?: boolean;
};

/** Body accepted by POST /api/insights. */
export type InsightsRequest = { year: number; month: number /* 1-12 */ };
