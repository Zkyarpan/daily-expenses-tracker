"use client";

import { memo } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DailyPoint, MonthlyPoint } from "@/lib/analytics";
import { formatCurrencyCompact } from "@/lib/utils";

import { ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

const monthlyConfig = {
  total: { color: "var(--chart-1)", label: "Monthly spending" },
  trend: { color: "var(--chart-2)", label: "3-month average" },
} satisfies ChartConfig;

const dailyConfig = {
  cumulative: { color: "var(--chart-2)", label: "Running total" },
  total: { color: "var(--chart-1)", label: "Daily spending" },
} satisfies ChartConfig;

type SpendingTrendChartProps = {
  monthly: MonthlyPoint[];
  daily: DailyPoint[] | null;
  hasData: boolean;
};

/**
 * Spending over time. Short periods (≤ 62 days) are shown day by day with a
 * running total; longer periods month by month with a 3-month rolling
 * average to show the underlying trend.
 */
const SpendingTrendChart = ({ daily, hasData, monthly }: SpendingTrendChartProps) => {
  const isDaily = !!daily;
  const showTrend = !isDaily && monthly.length >= 3;

  return (
    <Card className="min-w-0 shadow-none lg:col-span-2">
      <CardHeader>
        <CardTitle>Spending trend</CardTitle>
        <CardDescription>
          {isDaily
            ? "Daily spending and running total for the period"
            : showTrend
              ? "Monthly spending with a 3-month rolling average"
              : "Monthly spending for the period"}
        </CardDescription>
      </CardHeader>
      {/* flex-1: the chart grows to the row height set by the donut card */}
      <CardContent className="flex flex-1 flex-col">
        {!hasData ? (
          <ChartEmptyState
            icon={<LineChartIcon className="size-5" />}
            title="No spending to chart"
            description="There are no expenses in this period for the selected categories."
          />
        ) : isDaily ? (
          <ChartContainer config={dailyConfig} className="aspect-auto min-h-[280px] w-full flex-1">
            <ComposedChart accessibilityLayer data={daily} margin={{ left: 4, right: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
              <YAxis yAxisId="day" tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <YAxis yAxisId="cum" orientation="right" tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(dailyConfig)} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar yAxisId="day" dataKey="total" fill="var(--color-total)" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Line yAxisId="cum" dataKey="cumulative" type="monotone" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={monthlyConfig} className="aspect-auto min-h-[280px] w-full flex-1">
            <ComposedChart accessibilityLayer data={monthly} margin={{ left: 4, right: 12 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(monthlyConfig)} />} />
              {showTrend && <ChartLegend content={<ChartLegendContent />} />}
              <Line dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              {showTrend && (
                <Line dataKey="trend" type="monotone" stroke="var(--color-trend)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(SpendingTrendChart);
