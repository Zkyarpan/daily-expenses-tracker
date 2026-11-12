"use client";

import { memo, useMemo } from "react";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { CategoryTotal } from "@/lib/analytics";
import { formatCurrency, formatCurrencyCompact, getCategoryColor } from "@/lib/utils";

import { ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

type CategoryDonutChartProps = {
  categories: CategoryTotal[];
};

/**
 * Category distribution donut. Only categories with positive net spending are
 * drawn (a slice cannot be negative); the legend lists every slice with its
 * amount and share, so the information is available without hovering.
 */
const CategoryDonutChart = ({ categories }: CategoryDonutChartProps) => {
  const slices = useMemo(() => categories.filter((c) => c.total > 0), [categories]);
  const total = useMemo(() => slices.reduce((s, c) => s + Math.round(c.total * 100), 0) / 100, [slices]);

  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(slices.map((c) => [c.name, { color: getCategoryColor(c.name), label: c.name }])),
    [slices],
  );

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <CardTitle>Category distribution</CardTitle>
        <CardDescription>Share of spending by category</CardDescription>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <ChartEmptyState
            icon={<PieChartIcon className="size-5" />}
            title="No category spending"
            description="Category shares appear once there is spending in this period."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <ChartContainer config={config} className="mx-auto aspect-square h-[200px]">
              <PieChart accessibilityLayer>
                <ChartTooltip content={<ChartTooltipContent hideLabel formatter={moneyTooltipFormatter(config)} />} />
                <Pie data={slices} dataKey="total" nameKey="name" innerRadius={58} outerRadius={90} strokeWidth={2} paddingAngle={1}>
                  {slices.map((c) => (
                    <Cell key={c.key} fill={getCategoryColor(c.name)} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null;
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 6} className="fill-foreground text-lg font-semibold">
                            {formatCurrencyCompact(total)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 14} className="fill-muted-foreground text-xs">
                            total
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="space-y-2 text-sm" aria-label="Category shares">
              {slices.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getCategoryColor(c.name) }} aria-hidden />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatCurrency(c.total)} · {c.share.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default memo(CategoryDonutChart);
