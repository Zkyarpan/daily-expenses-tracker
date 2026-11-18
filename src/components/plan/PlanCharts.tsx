"use client";

/**
 * Charts for the Savings plan. Loaded with next/dynamic so Recharts is only
 * downloaded when the plan page is open.
 */

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { ProjectionPoint } from "@/lib/plan/calc";
import type { PlanMonth } from "@/lib/plan/schemas";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils";

const historyConfig = { saved: { color: "var(--success)", label: "Saved" } } satisfies ChartConfig;
const projectionConfig = { total: { color: "var(--chart-1)", label: "Total saved" } } satisfies ChartConfig;

const moneyFormatter = (value: unknown) => (
  <span className="text-foreground font-mono font-medium tabular-nums">{formatCurrency(Number(value))}</span>
);

/** Saved per month (income − fixed costs − everyday spending); the current month is lighter. */
export function SavingsHistoryChart({ history, target }: { history: PlanMonth[]; target: number | null }) {
  const data = history.map((h) => ({ ...h, label: h.complete ? h.label.slice(0, 3) : `${h.label.slice(0, 3)} (so far)`, saved: h.saved ?? 0 }));
  return (
    <ChartContainer config={historyConfig} className="aspect-auto h-[240px] w-full">
      <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => formatCurrencyCompact(v)} />
        <ChartTooltip content={<ChartTooltipContent formatter={moneyFormatter} />} />
        {target !== null && target > 0 && (
          <ReferenceLine
            y={target}
            stroke="var(--muted-foreground)"
            strokeDasharray="5 4"
            label={{ fill: "var(--muted-foreground)", fontSize: 11, position: "insideTopRight", value: `Target ${formatCurrencyCompact(target)}` }}
          />
        )}
        <ReferenceLine y={0} stroke="var(--border)" />
        <Bar dataKey="saved" radius={[5, 5, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell
              key={d.month}
              fill={d.saved < 0 ? "var(--destructive)" : "var(--success)"}
              fillOpacity={d.complete ? 1 : 0.45}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Total savings over time at the chosen monthly amount. */
export function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  const gradientId = `projection-${useId().replace(/:/g, "")}`;
  return (
    <ChartContainer config={projectionConfig} className="aspect-auto h-[260px] w-full">
      <AreaChart accessibilityLayer data={points} margin={{ left: 0, right: 12, top: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} tick={{ fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCurrencyCompact(v)} />
        <ChartTooltip content={<ChartTooltipContent formatter={moneyFormatter} />} />
        <Area dataKey="total" type="monotone" stroke="var(--color-total)" strokeWidth={2.5} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ChartContainer>
  );
}
