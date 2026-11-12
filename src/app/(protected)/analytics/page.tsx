"use client";

/**
 * src/app/(protected)/analytics/page.tsx
 *
 * Feature 6: Advanced Analytics and Financial Reports.
 *
 * Overview cards, spending charts and financial reports for a selected month,
 * year or custom date range, optionally filtered by category. Every figure on
 * the page comes from a single buildAnalytics() result (see useAnalytics), so
 * cards, charts, tables and CSV exports always agree.
 *
 * Data is the signed-in user's own expenses and budgets only (RLS + explicit
 * user filter). In demo mode (no Supabase configured) the sample dataset is
 * used and clearly labelled; live mode never shows sample figures.
 */

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, CalendarDays, Download, Loader2, ReceiptText, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import AnalyticsFilters from "@/components/analytics/AnalyticsFilters";
import AnalyticsOverview, { AnalyticsOverviewSkeleton } from "@/components/analytics/AnalyticsOverview";
import AnalyticsReports from "@/components/analytics/AnalyticsReports";
import { expensesData } from "@/components/expenses/data/expenseData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalytics } from "@/hooks/analytics/useAnalytics";
import {
  formatRangeLabel,
  fullReportCsv,
  type PeriodSelection,
  rangeLengthInDays,
  toDateKey,
} from "@/lib/analytics";
import { parseLocalDate } from "@/lib/dateUtils";
import { downloadCsv } from "@/lib/downloadCsv";
import { getIsDemoMode } from "@/lib/supabase";
import { getErrorMessage } from "@/lib/utils";

const ChartsSkeleton = () => (
  <div className="space-y-6" aria-hidden>
    <div className="grid gap-6 lg:grid-cols-3">
      <Skeleton className="h-[372px] rounded-xl lg:col-span-2" />
      <Skeleton className="h-[372px] rounded-xl" />
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Skeleton className="h-[372px] rounded-xl" />
      <Skeleton className="h-[372px] rounded-xl" />
    </div>
  </div>
);

// Recharts is only downloaded when charts render (same as Yearly Charts).
const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  loading: () => <ChartsSkeleton />,
  ssr: false,
});

const isDemoMode = getIsDemoMode();
const ALL_CATEGORIES: string[] = [];

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const defaultSelection = (): PeriodSelection => {
  if (isDemoMode) {
    // Sample data lives in a fixed year; open on it so the demo is not empty.
    const demoYear = expensesData.reduce(
      (latest, e) => Math.max(latest, parseLocalDate(e.date).getFullYear()),
      0,
    );
    return { kind: "year", year: demoYear || new Date().getFullYear() };
  }
  const now = new Date();
  return { kind: "month", month: now.getMonth(), year: now.getFullYear() };
};

const comparisonLabelFor = (selection: PeriodSelection, previousStart: Date, days: number) => {
  if (selection.kind === "month") {
    return `vs ${SHORT_MONTHS[previousStart.getMonth()]} ${previousStart.getFullYear()}`;
  }
  if (selection.kind === "year") return `vs ${selection.year - 1}`;
  return `vs previous ${days} ${days === 1 ? "day" : "days"}`;
};

const sameSelection = (a: PeriodSelection, b: PeriodSelection) => JSON.stringify(a) === JSON.stringify(b);

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [initialSelection] = useState(defaultSelection);
  const [selection, setSelection] = useState<PeriodSelection>(initialSelection);
  const [categoryKeys, setCategoryKeys] = useState<string[]>(ALL_CATEGORIES);

  const analytics = useAnalytics(selection, categoryKeys);
  const { data } = analytics;

  const isDefault = categoryKeys.length === 0 && sameSelection(selection, initialSelection);
  const handleReset = useCallback(() => {
    setSelection(initialSelection);
    setCategoryKeys(ALL_CATEGORIES);
  }, [initialSelection]);

  const comparisonLabel = useMemo(
    () => (data ? comparisonLabelFor(selection, data.previousRange.start, rangeLengthInDays(data.range)) : ""),
    [data, selection],
  );

  const budgetTotals = useMemo(
    () => (data?.budgets ? { limit: data.budgets.totalLimit, spent: data.budgets.totalSpent } : null),
    [data],
  );

  const handleExportAll = () => {
    if (!data) return;
    downloadCsv(
      `financial-report_${toDateKey(data.range.start)}_${toDateKey(data.range.end)}`,
      fullReportCsv(data, new Date()),
    );
  };

  const hasPeriodData = !!data && data.periodExpenses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-muted-foreground mb-2 flex flex-wrap items-center gap-2 text-sm">
            <CalendarDays className="size-4" aria-hidden />
            <span>{data ? formatRangeLabel(data.range) : "Loading period…"}</span>
            {isDemoMode && <Badge variant="secondary">Demo data</Badge>}
            {analytics.isUpdating && (
              <span className="inline-flex items-center gap-1 text-xs" role="status">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Updating…
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics &amp; reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Understand your spending, compare periods and export financial reports.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/yearly-charts">
              Yearly charts
              <ArrowUpRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleExportAll} disabled={!data}>
            <Download className="size-4" aria-hidden />
            Export full report (CSV)
          </Button>
        </div>
      </div>

      <AnalyticsFilters
        selection={selection}
        onSelectionChange={setSelection}
        categoryKeys={categoryKeys}
        onCategoryKeysChange={setCategoryKeys}
        isDefault={isDefault}
        onReset={handleReset}
      />

      {/* Error state */}
      {!!analytics.error && (
        <Card className="border-destructive/40 shadow-none">
          <CardContent className="flex flex-col items-center px-6 py-10 text-center">
            <AlertTriangle className="text-destructive mb-3 size-8" aria-hidden />
            <p className="font-medium">Analytics could not be loaded</p>
            <p className="text-muted-foreground mt-1 max-w-md text-sm">
              {getErrorMessage(analytics.error, "An unexpected error occurred.")}
            </p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["yearly-expenses"] })}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {analytics.isLoading && (
        <>
          <AnalyticsOverviewSkeleton />
          <ChartsSkeleton />
        </>
      )}

      {data && (
        <div
          className={analytics.isUpdating ? "opacity-70 transition-opacity" : "transition-opacity"}
          aria-busy={analytics.isUpdating}
        >
          <div className="space-y-6">
            <AnalyticsOverview
              overview={data.overview}
              budgetTotals={budgetTotals}
              budgetsStatus={analytics.budgetsStatus}
              comparisonLabel={comparisonLabel}
            />

            {hasPeriodData ? (
              <>
                <AnalyticsCharts data={data} budgetsStatus={analytics.budgetsStatus} />
                <AnalyticsReports data={data} budgetsStatus={analytics.budgetsStatus} />
              </>
            ) : (
              <Card className="border-dashed shadow-none">
                <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <div className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
                    <ReceiptText className="size-7" aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold">No expenses in this period</h2>
                  <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
                    {categoryKeys.length > 0
                      ? "Nothing was spent in the selected categories. Try including more categories or choosing a different period."
                      : "Choose a different month, year or date range, or add expenses to start building your reports."}
                  </p>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    {!isDefault && (
                      <Button variant="outline" onClick={handleReset}>
                        Reset filters
                      </Button>
                    )}
                    <Button asChild>
                      <Link href="/expenses">Add expenses</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href="/import-expenses">
                        <Upload className="mr-2 size-4" aria-hidden />
                        Import a statement
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <p className="text-muted-foreground text-xs">
              Calculated from {analytics.recordsLoaded.toLocaleString("en-GB")} expense
              {analytics.recordsLoaded === 1 ? "" : "s"} loaded for {analytics.years.join(", ")}
              {analytics.computeMs !== null && ` in ${analytics.computeMs.toFixed(1)} ms`}. Amounts in GBP.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
