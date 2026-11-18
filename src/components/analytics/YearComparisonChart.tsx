"use client";

import { memo, useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Delta } from "@/components/shared/StatCard";
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { percentChange, sumAmounts, type YearComparisonPoint } from "@/lib/analytics";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

import { AnalyticsPanel, ChartEmptyState, moneyTooltipFormatter, REFERENCE_FILL } from "./chartShared";

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
        previous: { color: REFERENCE_FILL, label: String(year - 1) },
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
  const changePct = percentChange(totals.current, totals.previous);

  return (
    <AnalyticsPanel
      title="Yearly comparison"
      description={
        <span className="tabular-nums">
          {year}: {formatCurrency(totals.current)} · {year - 1}: {formatCurrency(totals.previous)}
        </span>
      }
      action={
        hasData && changePct !== null ? (
          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Delta delta={{ goodDirection: "down", value: changePct }} />
            vs {year - 1}
          </span>
        ) : undefined
      }
    >
      {!hasData ? (
        <ChartEmptyState
          icon={<BarChart3 className="size-5" />}
          title={`No spending in ${year - 1} or ${year}`}
          description="The comparison appears once either year has expenses in the selected categories."
        />
      ) : (
        <ChartContainer config={config} className="aspect-auto h-[300px] w-full">
          <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 8 }} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
            <ChartTooltip content={<ChartTooltipContent formatter={moneyTooltipFormatter(config)} />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="previous" fill="var(--color-previous)" radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ChartContainer>
      )}
    </AnalyticsPanel>
  );
};

export default memo(YearComparisonChart);
