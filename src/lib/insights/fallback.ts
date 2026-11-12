/**
 * src/lib/insights/fallback.ts
 *
 * Feature 7: deterministic, rule-based insights built only from the
 * InsightsSummary. Used whenever the AI is unavailable, misconfigured, rate
 * limited, slow, or returns unusable/ungrounded text — so users always get a
 * useful answer and every figure is exact.
 */

import type { Insight, InsightsSummary } from "@/entities/Insights";

import { MAX_INSIGHTS } from "./prompt";

const GBP = new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" });
export const gbp = (n: number) => GBP.format(n);
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

export function buildFallbackHeadline(s: InsightsSummary): string {
  const t = s.totals;
  if (t.transactions === 0) return `No spending recorded for ${s.period.label} yet.`;
  const base = `You spent ${gbp(t.spending)} in ${s.period.label} across ${t.transactions} ${
    t.transactions === 1 ? "transaction" : "transactions"
  }`;
  return t.projectedMonthEnd !== null
    ? `${base}, on track for about ${gbp(t.projectedMonthEnd)} by month end.`
    : `${base}.`;
}

export function buildFallbackInsights(s: InsightsSummary): Insight[] {
  if (s.totals.transactions === 0) return [];
  const out: Insight[] = [];
  const rows = s.budgets?.rows ?? [];

  // 1. Budget risks — over budget first, then projected overspend, then ≥ warning.
  for (const r of rows.filter((r) => r.status === "over")) {
    out.push({
      detail: `You've spent ${gbp(r.spent)} against a ${gbp(r.limit)} budget, ${gbp(-r.remaining)} over the limit.`,
      kind: "risk",
      title: `${r.category} is over budget`,
    });
  }
  for (const r of rows.filter((r) => r.status !== "over" && r.projectedSpend !== null && r.projectedSpend > r.limit)) {
    out.push({
      detail: `${gbp(r.spent)} spent so far; at this pace it would reach about ${gbp(r.projectedSpend!)} by month end against a ${gbp(r.limit)} budget.`,
      kind: "risk",
      title: `${r.category} is on track to exceed its budget`,
    });
  }
  for (const r of rows.filter(
    (r) => (r.status === "warning" || r.status === "critical") && !(r.projectedSpend !== null && r.projectedSpend > r.limit),
  )) {
    out.push({
      detail: `${gbp(r.remaining)} of the ${gbp(r.limit)} budget is left.`,
      kind: "risk",
      title: `${r.category} has used ${pct(r.utilisationPct)} of its budget`,
    });
  }

  // 2. Month-over-month trend.
  const t = s.totals;
  if (t.changeVsPreviousMonthPct !== null && t.changeVsPreviousMonthPct !== 0) {
    const up = t.changeVsPreviousMonthPct > 0;
    out.push({
      detail: `${gbp(t.spending)} this month compared with ${gbp(t.previousMonthSpending)} the month before${
        s.period.isCurrentMonth ? " (this month is still in progress)" : ""
      }.`,
      kind: up ? "trend" : "positive",
      title: `Spending is ${up ? "up" : "down"} ${pct(Math.abs(t.changeVsPreviousMonthPct))} on last month`,
    });
  }

  // 3. Largest category.
  const largest = s.categories.find((c) => c.total > 0);
  if (largest) {
    out.push({
      detail: `${gbp(largest.total)}, ${pct(largest.sharePct)} of this month's spending, across ${largest.transactions} ${
        largest.transactions === 1 ? "transaction" : "transactions"
      }.`,
      kind: "trend",
      title: `${largest.category} is your largest category`,
    });
  }

  // 4. Savings opportunities (pre-calculated in the summary).
  for (const o of s.savingsOpportunities.slice(0, 2)) {
    out.push({
      detail: `${o.action} to save about ${gbp(o.amount)}.`,
      kind: "saving",
      title: `Potential saving: ${gbp(o.amount)}`,
    });
  }

  // 5. Budgets: encourage setting them, or reassure when all are on track.
  if (!s.budgets || rows.length === 0) {
    out.push({
      detail: `Monthly category budgets let the app warn you at ${s.thresholds.warningPct}% and ${s.thresholds.limitPct}% of each limit.`,
      kind: "saving",
      title: "Set budgets for your main categories",
    });
  } else if (rows.every((r) => r.status === "under" && !(r.projectedSpend !== null && r.projectedSpend > r.limit))) {
    out.push({
      detail: `Budgeted spending is ${gbp(s.budgets.totalSpent)} of ${gbp(s.budgets.totalLimit)} so far.`,
      kind: "positive",
      title: "All budgets are on track",
    });
  }

  return out.slice(0, MAX_INSIGHTS);
}
