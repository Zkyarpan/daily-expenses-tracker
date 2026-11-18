"use client";

import { memo, useMemo } from "react";
import { AlertTriangle, PiggyBank } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import type { BudgetStatus, BudgetSummary } from "@/lib/analytics";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

import { AnalyticsPanel, ChartEmptyState, LegendSwatches, moneyTooltipFormatter, REFERENCE_FILL } from "./chartShared";

const config = {
  actual: { color: "var(--chart-1)", label: "Actual" },
  budget: { color: REFERENCE_FILL, label: "Budget" },
} satisfies ChartConfig;

/** Actual bars are coloured by status — the same thresholds as spending alerts. */
const STATUS_COLOR: Record<BudgetStatus, string> = {
  critical: "var(--warning)",
  over: "var(--destructive)",
  under: "var(--success)",
  warning: "var(--warning)",
};

const STATUS_LEGEND: { label: string; statuses: BudgetStatus[]; color: string }[] = [
  { color: STATUS_COLOR.under, label: "On track", statuses: ["under"] },
  { color: STATUS_COLOR.warning, label: "Near or at limit", statuses: ["warning", "critical"] },
  { color: STATUS_COLOR.over, label: "Over budget", statuses: ["over"] },
];

const shortName = (name: string) => (name.length > 11 ? `${name.slice(0, 10)}…` : name);

const tooltipFormatter = moneyTooltipFormatter(config, (key, payload) =>
  key === "actual" && payload?.status ? STATUS_COLOR[payload.status as BudgetStatus] : undefined,
);

type BudgetVsActualChartProps = {
  summary: BudgetSummary | null;
  status: BudgetsForYearsStatus;
};

const BudgetVsActualChart = ({ status, summary }: BudgetVsActualChartProps) => {
  const data = useMemo(
    () => (summary?.rows ?? []).map((r) => ({ actual: r.spent, budget: r.limit, name: r.name, status: r.status })),
    [summary],
  );

  const legend = useMemo(() => {
    const present = new Set(data.map((d) => d.status));
    return [
      { color: REFERENCE_FILL, label: "Budget" },
      ...STATUS_LEGEND.filter((s) => s.statuses.some((st) => present.has(st))),
    ];
  }, [data]);

  const body = (() => {
    if (status === "loading") return <Skeleton className="h-[300px] w-full rounded-xl" />;
    if (status === "unavailable") {
      return (
        <ChartEmptyState
          icon={<PiggyBank className="size-5" />}
          title="Budgets are not set up yet"
          description="Budget data is not available for this account yet, so no budget figures are shown. Once budgets can be saved, this chart compares them with actual spending."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/budgets">Go to budgets</Link>
            </Button>
          }
        />
      );
    }
    if (status === "error") {
      return (
        <ChartEmptyState
          icon={<AlertTriangle className="size-5" />}
          title="Budgets could not be loaded"
          description="Spending analytics are unaffected. Try again later."
        />
      );
    }
    if (data.length === 0) {
      return (
        <ChartEmptyState
          icon={<PiggyBank className="size-5" />}
          title="No budgets in this period"
          description="Set a monthly budget for a category to compare it with what you actually spent."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/budgets">Set a budget</Link>
            </Button>
          }
        />
      );
    }
    return (
      <div className="flex flex-1 flex-col">
        <ChartContainer config={config} className="aspect-auto h-[272px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 8 }} barGap={3}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              interval={0}
              tick={{ fontSize: 11 }}
              tickFormatter={shortName}
            />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
            <ChartTooltip content={<ChartTooltipContent formatter={tooltipFormatter} />} />
            <Bar dataKey="budget" fill="var(--color-budget)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {data.map((d) => (
                <Cell key={d.name} fill={STATUS_COLOR[d.status]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        <LegendSwatches items={legend} />
      </div>
    );
  })();

  const hasRows = !!summary && summary.rows.length > 0;

  return (
    <AnalyticsPanel
      title="Budget versus actual"
      description={
        hasRows
          ? `${formatCurrency(summary.totalSpent)} spent of ${formatCurrency(summary.totalLimit)} budgeted`
          : "Monthly category budgets compared with actual spending"
      }
      action={
        hasRows && status === "ready" ? (
          summary.overBudgetCount > 0 ? (
            <StatusBadge tone="critical" dot>
              {summary.overBudgetCount} over budget
            </StatusBadge>
          ) : (
            <StatusBadge tone="success" dot>
              All within budget
            </StatusBadge>
          )
        ) : undefined
      }
    >
      {body}
    </AnalyticsPanel>
  );
};

export default memo(BudgetVsActualChart);
