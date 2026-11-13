"use client";

import { useMemo, useState } from "react";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { ExpenseWithDetails } from "@/entities/Expense";
import { getShortMonthLabels, parseLocalDate } from "@/lib/dateUtils";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";

import { ChartHeader } from "./ChartHeader";

interface MonthlySpendingChartProps {
  expenses: ExpenseWithDetails[];
  year: number;
  /** Override the card title (e.g. on the dashboard). */
  title?: string;
  description?: string;
  /** Extra control shown before the chart-type toggle, e.g. a link. */
  headerExtra?: React.ReactNode;
}

const chartConfig = {
  amount: {
    color: "var(--chart-1)",
    label: "Spending",
  },
} satisfies ChartConfig;

const MonthlySpendingChart = ({
  expenses,
  title = "Monthly spending",
  description = "Total spent in each month",
  headerExtra,
}: MonthlySpendingChartProps) => {
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  const { monthlyData, maxAmount } = useMemo(() => {
    const months = getShortMonthLabels();

    const monthlyTotals = new Array(12).fill(0);

    expenses.forEach((expense) => {
      const month = parseLocalDate(expense.date as unknown as string).getMonth();
      monthlyTotals[month] += expense.amount;
    });

    const max = Math.max(...monthlyTotals);

    return {
      maxAmount: max,
      monthlyData: months.map((month, index) => ({
        amount: monthlyTotals[index],
        month,
      })),
    };
  }, [expenses]);

  return (
    <div>
      <ChartHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
          {headerExtra}
          <div
            className="bg-muted flex gap-0.5 rounded-lg p-0.5"
            role="group"
            aria-label="Chart type"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {(
              [
                { icon: LineChartIcon, label: "Area chart", type: "area" },
                { icon: BarChart3, label: "Bar chart", type: "bar" },
              ] as const
            ).map(({ icon: Icon, label, type }) => (
              <button
                key={type}
                type="button"
                aria-label={label}
                aria-pressed={chartType === type}
                onClick={() => setChartType(type)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  chartType === type
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
          </div>
        }
      />

      <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
        {chartType === "area" ? (
          <AreaChart accessibilityLayer data={monthlyData}>
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-amount)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-amount)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                formatCurrencyCompact(value)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="var(--color-amount)"
              fill="url(#colorAmount)"
              strokeWidth={2}
            />
          </AreaChart>
        ) : (
          <BarChart accessibilityLayer data={monthlyData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                formatCurrencyCompact(value)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => formatCurrency(value as number)}
                />
              }
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {monthlyData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill="var(--color-amount)"
                  fillOpacity={maxAmount > 0 && entry.amount === maxAmount ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
};

export default MonthlySpendingChart;
