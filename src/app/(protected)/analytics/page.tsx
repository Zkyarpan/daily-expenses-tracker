"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChartColumn, Download, Loader2, ReceiptText, Upload } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import AnalyticsFilters from "@/components/analytics/AnalyticsFilters";
import AnalyticsOverview from "@/components/analytics/AnalyticsOverview";
import AnalyticsReports from "@/components/analytics/AnalyticsReports";
import { expensesData } from "@/components/expenses/data/expenseData";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { AnalyticsBodySkeleton, AnalyticsChartsSkeleton } from "@/components/shared/PageSkeletons";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
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

const AnalyticsCharts = dynamic(() => import("@/components/analytics/AnalyticsCharts"), {
  loading: () => <AnalyticsChartsSkeleton />,
  ssr: false,
});

const isDemoMode = getIsDemoMode();
const ALL_CATEGORIES: string[] = [];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const defaultSelection = (): PeriodSelection => {
  if (isDemoMode) {
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

const sameSelection = (a: PeriodSelection, b: PeriodSelection) =>
  JSON.stringify(a) === JSON.stringify(b);

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
    () =>
      data
        ? comparisonLabelFor(
            selection,
            data.previousRange.start,
            rangeLengthInDays(data.range),
          )
        : "",
    [data, selection],
  );

  const budgetTotals = useMemo(
    () =>
      data?.budgets
        ? { limit: data.budgets.totalLimit, spent: data.budgets.totalSpent }
        : null,
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
      <PageHeader
        eyebrow={
          <>
            <span className="text-xs font-semibold tracking-wider uppercase">
              {data ? formatRangeLabel(data.range) : "Loading period…"}
            </span>
            {isDemoMode && <StatusBadge>Demo data</StatusBadge>}
            {analytics.isUpdating && (
              <span className="inline-flex items-center gap-1 text-xs" role="status">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Updating…
              </span>
            )}
          </>
        }
        title="Analytics & reports"
        description="Understand your spending, compare periods and export financial reports."
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/yearly-charts">
                <ChartColumn className="size-3.5" aria-hidden />
                Yearly charts
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleExportAll} disabled={!data}>
              <Download className="size-3.5" aria-hidden />
              Export report
            </Button>
          </>
        }
      />

      {/* Filters */}
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
        <ErrorState
          title="Analytics could not be loaded"
          message={getErrorMessage(analytics.error, "An unexpected error occurred.")}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["yearly-expenses"] })}
        />
      )}

      {/* Loading state */}
      {analytics.isLoading && <AnalyticsBodySkeleton />}

      {/* Data */}
      {data && (
        <div
          className={analytics.isUpdating ? "opacity-70 transition-opacity" : "transition-opacity"}
          aria-busy={analytics.isUpdating}
        >
          <div className="space-y-4">
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
              <EmptyState
                headingLevel="h2"
                icon={ReceiptText}
                title="No expenses in this period"
                description={
                  categoryKeys.length > 0
                    ? "Nothing was spent in the selected categories. Try including more categories or choosing a different period."
                    : "Choose a different month, year or date range, or add expenses to start building your reports."
                }
                actions={
                  <>
                    <Button asChild size="sm">
                      <Link href="/expenses">Add expenses</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/import-expenses">
                        <Upload className="size-3.5" aria-hidden />
                        Import a statement
                      </Link>
                    </Button>
                    {!isDefault && (
                      <Button variant="ghost" size="sm" onClick={handleReset}>
                        Reset filters
                      </Button>
                    )}
                  </>
                }
              />
            )}

            <p className="text-muted-foreground pt-2 text-center text-xs">
              Calculated from {analytics.recordsLoaded.toLocaleString("en-GB")} expense
              {analytics.recordsLoaded === 1 ? "" : "s"} loaded for {analytics.years.join(", ")}
              {analytics.computeMs !== null ? ` in ${analytics.computeMs.toFixed(1)} ms` : ""}.
              Amounts in GBP.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
