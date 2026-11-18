"use client";

import { memo, useId } from "react";
import { LineChart as LineChartIcon } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DailyPoint, MonthlyPoint } from "@/lib/analytics";
import { formatCurrencyCompact } from "@/lib/utils";

import { AnalyticsPanel, ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

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
  const gradientId = `trend-fill-${useId().replace(/:/g, "")}`;
  const isDaily = !!daily;
  const showTrend = !isDaily && monthly.length >= 3;

  return (
    <AnalyticsPanel
      className="lg:col-span-2"
      title="Spending trend"
      description={
        isDaily
          ? "Daily spending and running total for the period"
          : showTrend
            ? "Monthly spending with a 3-month rolling average"
            : "Monthly spending for the period"
      }
    >
      {/* flex-1: the chart grows to the row height set by the category panel */}
      {!hasData ? (
        <ChartEmptyState
          icon={<LineChartIcon className="size-5" />}
          title="No spending to chart"
          description="There are no expenses in this period for the selected categories."
        />
      ) : isDaily ? (
        <ChartContainer config={dailyConfig} className="aspect-auto min-h-[300px] w-full flex-1">
          <ComposedChart accessibilityLayer data={daily} margin={{ left: 0, right: 0, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={24} />
            <YAxis yAxisId="day" tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
            <YAxis yAxisId="cum" orientation="right" tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
            <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(dailyConfig)} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar yAxisId="day" dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Line yAxisId="cum" dataKey="cumulative" type="monotone" stroke="var(--color-cumulative)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      ) : (
        <ChartContainer config={monthlyConfig} className="aspect-auto min-h-[300px] w-full flex-1">
          <ComposedChart accessibilityLayer data={monthly} margin={{ left: 0, right: 12, top: 8 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
            <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(monthlyConfig)} />} />
            {showTrend && <ChartLegend content={<ChartLegendContent />} />}
            <Area
              dataKey="total"
              type="monotone"
              stroke="var(--color-total)"
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ fill: "var(--card)", r: 3, strokeWidth: 2 }}
              activeDot={{ r: 5 }}
            />
            {showTrend && (
              <Line dataKey="trend" type="monotone" stroke="var(--color-trend)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
            )}
          </ComposedChart>
        </ChartContainer>
      )}
    </AnalyticsPanel>
  );
};

export default memo(SpendingTrendChart);
