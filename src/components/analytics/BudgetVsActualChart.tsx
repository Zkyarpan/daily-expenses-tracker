"use client";

import { memo, useMemo } from "react";
import { AlertTriangle, PiggyBank } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import type { BudgetStatus, BudgetSummary } from "@/lib/analytics";
import { GREEN, ORANGE, RED } from "@/lib/config";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

import { ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

const config = {
  actual: { color: "var(--chart-1)", label: "Actual" },
  budget: { color: "var(--muted-foreground)", label: "Budget" },
} satisfies ChartConfig;

/** Actual bars are coloured by status — the same thresholds as spending alerts. */
const STATUS_COLOR: Record<BudgetStatus, string> = {
  critical: ORANGE,
  over: RED,
  under: GREEN,
  warning: ORANGE,
};

type BudgetVsActualChartProps = {
  summary: BudgetSummary | null;
  status: BudgetsForYearsStatus;
};

const BudgetVsActualChart = ({ status, summary }: BudgetVsActualChartProps) => {
  const data = useMemo(
    () => (summary?.rows ?? []).map((r) => ({ actual: r.spent, budget: r.limit, name: r.name, status: r.status })),
    [summary],
  );

  const body = (() => {
    if (status === "loading") return <Skeleton className="h-[280px] w-full rounded-lg" />;
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
      <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
        <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }} barGap={4}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 11 }} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
          <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(config)} />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="budget" fill="var(--color-budget)" fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.name} fill={STATUS_COLOR[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    );
  })();

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <CardTitle>Budget versus actual</CardTitle>
        <CardDescription>
          {summary && summary.rows.length > 0
            ? `${formatCurrency(summary.totalSpent)} spent of ${formatCurrency(summary.totalLimit)} budgeted${
                summary.overBudgetCount > 0 ? ` · ${summary.overBudgetCount} over budget` : ""
              }`
            : "Monthly category budgets compared with actual spending"}
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};

export default memo(BudgetVsActualChart);
