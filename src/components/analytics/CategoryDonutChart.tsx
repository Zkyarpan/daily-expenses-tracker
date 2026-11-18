"use client";

import { memo, useMemo } from "react";
import { PieChart as PieChartIcon } from "lucide-react";
import { Cell, Label, Pie, PieChart } from "recharts";

import { Money } from "@/components/shared/Money";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { CategoryTotal } from "@/lib/analytics";
import { formatCurrencyCompact, getCategoryColor } from "@/lib/utils";

import { AnalyticsPanel, ChartEmptyState, moneyTooltipFormatter } from "./chartShared";

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
    <AnalyticsPanel
      title="Category distribution"
      description={
        slices.length > 0
          ? `${slices.length} ${slices.length === 1 ? "category" : "categories"} with spending`
          : "Share of spending by category"
      }
    >
      {slices.length === 0 ? (
        <ChartEmptyState
          icon={<PieChartIcon className="size-5" />}
          title="No category spending"
          description="Category shares appear once there is spending in this period."
        />
      ) : (
        <div className="flex flex-col gap-5">
          <ChartContainer config={config} className="mx-auto aspect-square h-[190px]">
            <PieChart accessibilityLayer>
              <ChartTooltip content={<ChartTooltipContent hideLabel formatter={moneyTooltipFormatter(config)} />} />
              <Pie
                data={slices}
                dataKey="total"
                nameKey="name"
                innerRadius={62}
                outerRadius={90}
                stroke="var(--card)"
                strokeWidth={3}
                cornerRadius={4}
                paddingAngle={slices.length > 1 ? 1.5 : 0}
              >
                {slices.map((c) => (
                  <Cell key={c.key} fill={getCategoryColor(c.name)} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox)) return null;
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 7} className="fill-foreground text-xl font-semibold tabular-nums">
                          {formatCurrencyCompact(total)}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 15} className="fill-muted-foreground text-xs">
                          spent
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className="space-y-0.5 text-sm" aria-label="Category shares">
            {slices.map((c) => (
              <li
                key={c.key}
                className="hover:bg-muted/60 -mx-2 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getCategoryColor(c.name) }} aria-hidden />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="text-muted-foreground w-12 text-right text-xs tabular-nums">{c.share.toFixed(1)}%</span>
                <Money amount={c.total} className="text-right font-medium" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </AnalyticsPanel>
  );
};

export default memo(CategoryDonutChart);
