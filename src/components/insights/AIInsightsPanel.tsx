"use client";

/**
 * Feature 7: AI spending insights panel (Dashboard).
 *
 * The user picks a month and clicks "Generate AI insights". The server
 * calculates the figures from the user's own records, asks Pollinations for
 * 3–5 recommendations grounded in those figures, and falls back to a
 * deterministic summary whenever the AI is unavailable.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  PiggyBank,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import MonthYearSelector from "@/components/expenses/MonthYearSelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Insight, InsightKind, InsightsFallbackReason, InsightsResponse } from "@/entities/Insights";
import { useSpendingInsights } from "@/hooks/insights/useSpendingInsights";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

const isDemoMode = getIsDemoMode();

const KIND_STYLE: Record<InsightKind, { icon: typeof Info; label: string; className: string }> = {
  positive: { className: "bg-green-500/10 text-green-700 dark:text-green-400", icon: CheckCircle2, label: "Positive" },
  risk: { className: "bg-destructive/10 text-destructive", icon: AlertTriangle, label: "Budget risk" },
  saving: { className: "bg-primary/10 text-primary", icon: PiggyBank, label: "Saving" },
  trend: { className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: TrendingUp, label: "Trend" },
};

const FALLBACK_MESSAGES: Record<InsightsFallbackReason, string> = {
  bad_response: "The AI's answer couldn't be read, so this is a standard summary calculated from your data.",
  blocked: "The AI service declined this request, so this is a standard summary calculated from your data.",
  insufficient_balance: "The AI service account has run out of credit, so this is a standard summary calculated from your data.",
  no_data: "",
  not_configured: "AI insights aren't configured on the server yet, so this is a standard summary calculated from your data.",
  rate_limited: "The AI service is busy right now, so this is a standard summary calculated from your data.",
  timeout: "The AI service took too long to respond, so this is a standard summary calculated from your data.",
  unauthorized: "The AI service rejected the server's API key, so this is a standard summary calculated from your data.",
  unavailable: "The AI service is unavailable right now, so this is a standard summary calculated from your data.",
  ungrounded: "The AI quoted figures that don't match your records, so this is a standard summary calculated from your data instead.",
};

const InsightCard = ({ insight }: { insight: Insight }) => {
  const style = KIND_STYLE[insight.kind];
  const Icon = style.icon;
  return (
    <li className="bg-card flex gap-3 rounded-xl border p-4">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", style.className)} aria-hidden>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 space-y-1">
        <p className="text-muted-foreground text-xs font-medium">{style.label}</p>
        <p className="text-sm leading-5 font-semibold">{insight.title}</p>
        <p className="text-muted-foreground text-sm leading-6">{insight.detail}</p>
      </div>
    </li>
  );
};

const FiguresUsed = ({ summary }: { summary: InsightsResponse["summary"] }) => {
  const t = summary.totals;
  const items: Array<[string, string]> = [
    ["Spending", formatCurrency(t.spending)],
    ["Transactions", String(t.transactions)],
    [
      "vs previous month",
      t.changeVsPreviousMonthPct === null
        ? "No spending last month"
        : `${t.changeVsPreviousMonthPct > 0 ? "+" : ""}${t.changeVsPreviousMonthPct}% (${formatCurrency(t.previousMonthSpending)})`,
    ],
    [
      "Budget utilisation",
      summary.budgets?.utilisationPct != null
        ? `${summary.budgets.utilisationPct}% of ${formatCurrency(summary.budgets.totalLimit)}`
        : summary.budgets
          ? "No budgets this month"
          : "Budgets unavailable",
    ],
  ];
  if (t.projectedMonthEnd !== null) items.push(["Projected month end", formatCurrency(t.projectedMonthEnd)]);

  return (
    <details className="group rounded-lg border px-4 py-3 text-sm">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer select-none font-medium">
        Figures used for {summary.period.label}
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 sm:block">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
};

export function AIInsightsPanel() {
  const now = new Date();
  const [period, setPeriod] = useState({ month0: now.getMonth(), year: now.getFullYear() });
  const insights = useSpendingInsights();
  const result = insights.data;
  const error = insights.error;

  const generate = () => insights.mutate({ month: period.month0 + 1, year: period.year });

  return (
    <Card className="shadow-none" aria-labelledby="ai-insights-title">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle id="ai-insights-title" className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" aria-hidden />
            AI spending insights
          </CardTitle>
          <CardDescription className="mt-1">
            Practical recommendations based on your monthly totals, categories and budgets.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearSelector
            currentMonth={period.month0}
            currentYear={period.year}
            onMonthYearChange={(month0, year) => {
              setPeriod({ month0, year });
              insights.reset(); // results belong to the previously selected month
            }}
          />
          <Button onClick={generate} disabled={insights.isPending || isDemoMode} className="gap-2">
            {insights.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {insights.isPending ? "Analysing…" : "Generate AI insights"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Only aggregated figures (monthly totals, category totals and budgets) are sent to Pollinations AI. Never
          descriptions, names or email addresses.
        </p>

        {isDemoMode && (
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Sign-in required</AlertTitle>
            <AlertDescription>AI insights analyse your own saved data, so they need a signed-in account.</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {insights.isPending && (
          <div className="space-y-3" aria-busy="true">
            <p className="text-muted-foreground text-sm" role="status">
              Calculating your figures and asking the AI. This can take up to 20 seconds…
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Request error (auth, rate limit, network) */}
        {error && !insights.isPending && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="size-4" />
            <AlertTitle>{error.status === 429 ? "Please wait a moment" : "Insights could not be generated"}</AlertTitle>
            <AlertDescription>
              {error.message}
              {error.status === 429 && error.retryAfterSeconds
                ? ` You can try again in ${error.retryAfterSeconds} seconds.`
                : ""}
            </AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {result && !insights.isPending && (
          <div className="space-y-4" aria-live="polite">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-base leading-7 font-medium">{result.headline}</p>
              <div className="flex shrink-0 gap-2">
                {result.source === "ai" ? (
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="size-3" aria-hidden />
                    AI-generated
                  </Badge>
                ) : (
                  result.fallbackReason !== "no_data" && <Badge variant="outline">Standard summary</Badge>
                )}
                {result.cached && <Badge variant="outline">Recent result</Badge>}
              </div>
            </div>

            {result.source === "fallback" && result.fallbackReason && result.fallbackReason !== "no_data" && (
              <Alert>
                <Info className="size-4" />
                <AlertDescription>{FALLBACK_MESSAGES[result.fallbackReason]}</AlertDescription>
              </Alert>
            )}

            {result.insights.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Spending insights">
                {result.insights.map((insight, i) => (
                  <InsightCard key={`${i}-${insight.title}`} insight={insight} />
                ))}
              </ul>
            ) : (
              <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
                There are no expenses in {result.summary.period.label} to analyse yet. Add or import expenses, or choose
                another month.
              </div>
            )}

            {result.insights.length > 0 && <FiguresUsed summary={result.summary} />}

            <p className="text-muted-foreground text-xs leading-5">
              Generated {new Date(result.generatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
              {result.source === "ai" && result.model ? ` with ${result.model}` : ""}. Figures are calculated from your
              own records{result.source === "ai" ? "; AI wording can be imperfect, and every quoted figure is checked against them" : ""}.
              This is not financial advice.
            </p>
          </div>
        )}

        {/* Idle */}
        {!result && !error && !insights.isPending && !isDemoMode && (
          <div className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
            Choose a month and select <span className="text-foreground font-medium">Generate AI insights</span> for 3–5
            tailored recommendations.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIInsightsPanel;
