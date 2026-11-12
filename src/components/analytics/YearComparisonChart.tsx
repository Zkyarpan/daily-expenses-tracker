"use client";

import { memo, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { percentChange, sumAmounts, type YearComparisonPoint } from "@/lib/analytics";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

import { ChangeIndicator } from "./AnalyticsOverview";
import { ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

type YearComparisonChartProps = {
  data: YearComparisonPoint[];
  year: number;
};

/** Month-by-month spending for the selected year against the year before. */
const YearComparisonChart = ({ data, year }: YearComparisonChartProps) => {
  const config = useMemo(
    () =>
      ({
        current: { color: "var(--chart-1)", label: String(year) },
        previous: { color: "var(--chart-3)", label: String(year - 1) },
      }) satisfies ChartConfig,
    [year],
  );

  const totals = useMemo(
    () => ({
      current: sumAmounts(data.map((d) => d.current)),
      previous: sumAmounts(data.map((d) => d.previous)),
    }),
    [data],
  );

  const hasData = totals.current !== 0 || totals.previous !== 0;

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <CardTitle>Yearly comparison</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-x-2">
          <span>
            {year}: {formatCurrency(totals.current)} · {year - 1}: {formatCurrency(totals.previous)}
          </span>
          {hasData && (
            <ChangeIndicator pct={percentChange(totals.current, totals.previous)} suffix={`vs ${year - 1}`} />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <ChartEmptyState
            icon={<BarChart3 className="size-5" />}
            title={`No spending in ${year - 1} or ${year}`}
            description="The comparison appears once either year has expenses in the selected categories."
          />
        ) : (
          <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
            <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 4 }} barGap={2}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
              <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(config)} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="previous" fill="var(--color-previous)" radius={[3, 3, 0, 0]} maxBarSize={16} />
              <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(YearComparisonChart);
