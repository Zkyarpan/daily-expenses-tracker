"use client";

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

const KIND_STYLE: Record<InsightKind, { icon: typeof Info; label: string; bg: string; text: string }> = {
  positive: {
    bg: "bg-success/10",
    icon: CheckCircle2,
    label: "Positive",
    text: "text-success",
  },
  risk: {
    bg: "bg-destructive/10",
    icon: AlertTriangle,
    label: "Budget risk",
    text: "text-destructive",
  },
  saving: {
    bg: "bg-primary/10",
    icon: PiggyBank,
    label: "Saving",
    text: "text-primary",
  },
  trend: {
    bg: "bg-warning/10",
    icon: TrendingUp,
    label: "Trend",
    text: "text-warning",
  },
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
    <li className="flex gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.bg, style.text)}
        aria-hidden
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 space-y-1">
        <p className={cn("text-[10px] font-semibold uppercase tracking-wider", style.text)}>
          {style.label}
        </p>
        <p className="text-sm font-semibold leading-snug">{insight.title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{insight.detail}</p>
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
  if (t.projectedMonthEnd !== null) {
    items.push(["Projected month end", formatCurrency(t.projectedMonthEnd)]);
  }

  return (
    <details className="group rounded-lg border border-border/60 px-4 py-3 text-sm">
      <summary className="cursor-pointer select-none font-medium text-muted-foreground hover:text-foreground transition-colors">
        Figures used for {summary.period.label}
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3 sm:block">
            <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
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
    <Card className="shadow-sm" aria-labelledby="ai-insights-title">
      <CardHeader className="flex flex-col gap-4 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle
            id="ai-insights-title"
            className="flex items-center gap-2 text-base font-semibold"
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
            </span>
            AI spending insights
          </CardTitle>
          <CardDescription className="mt-0.5 text-xs">
            Practical recommendations based on your monthly totals, categories and budgets.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthYearSelector
            currentMonth={period.month0}
            currentYear={period.year}
            onMonthYearChange={(month0, year) => {
              setPeriod({ month0, year });
              insights.reset();
            }}
          />
          <Button
            onClick={generate}
            disabled={insights.isPending || isDemoMode}
            size="sm"
            className="gap-1.5"
          >
            {insights.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {insights.isPending ? "Analysing…" : "Generate insights"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          Only aggregated figures (monthly totals, category totals and budgets) are sent to the AI.
          Never descriptions, names or email addresses.
        </p>

        {isDemoMode && (
          <Alert>
            <Info className="size-4" />
            <AlertTitle>Sign-in required</AlertTitle>
            <AlertDescription>
              AI insights analyse your own saved data, so they need a signed-in account.
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {insights.isPending && (
          <div className="space-y-3" aria-busy="true">
            <p className="text-sm text-muted-foreground" role="status">
              Calculating your figures and asking the AI. This can take up to 20 seconds…
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {/* Request error */}
        {error && !insights.isPending && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {error.status === 429 ? "Please wait a moment" : "Insights could not be generated"}
            </AlertTitle>
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
              <p className="text-sm font-semibold leading-relaxed">{result.headline}</p>
              <div className="flex shrink-0 gap-1.5">
                {result.source === "ai" ? (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <Sparkles className="size-2.5" aria-hidden />
                    AI-generated
                  </Badge>
                ) : (
                  result.fallbackReason !== "no_data" && (
                    <Badge variant="outline" className="text-[10px]">Standard summary</Badge>
                  )
                )}
                {result.cached && (
                  <Badge variant="outline" className="text-[10px]">Recent result</Badge>
                )}
              </div>
            </div>

            {result.source === "fallback" &&
              result.fallbackReason &&
              result.fallbackReason !== "no_data" && (
                <Alert>
                  <Info className="size-4" />
                  <AlertDescription>{FALLBACK_MESSAGES[result.fallbackReason]}</AlertDescription>
                </Alert>
              )}

            {result.insights.length > 0 ? (
              <ul
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                aria-label="Spending insights"
              >
                {result.insights.map((insight, i) => (
                  <InsightCard key={`${i}-${insight.title}`} insight={insight} />
                ))}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                There are no expenses in {result.summary.period.label} to analyse yet. Add or import
                expenses, or choose another month.
              </div>
            )}

            {result.insights.length > 0 && <FiguresUsed summary={result.summary} />}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Generated{" "}
              {new Date(result.generatedAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              {result.source === "ai" && result.model ? ` with ${result.model}` : ""}.
              Figures are calculated from your own records
              {result.source === "ai"
                ? "; AI wording can be imperfect, and every quoted figure is checked against them"
                : ""}
              . This is not financial advice.
            </p>
          </div>
        )}

        {/* Idle */}
        {!result && !error && !insights.isPending && !isDemoMode && (
          <div className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
            Choose a month and select{" "}
            <span className="font-medium text-foreground">Generate insights</span> for 3–5
            tailored recommendations.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIInsightsPanel;
