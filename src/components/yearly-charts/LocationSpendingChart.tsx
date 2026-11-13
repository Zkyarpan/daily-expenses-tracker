"use client";

import { useMemo } from "react";

import { ExpenseWithDetails } from "@/entities/Expense";
import { formatCurrency } from "@/lib/utils";

import { ChartEmpty, ChartHeader } from "./ChartHeader";

interface LocationSpendingChartProps {
  expenses: ExpenseWithDetails[];
}

/**
 * Ranked list of places with a proportional bar. One hue for every row: the
 * bar length carries the value, so places never need to be told apart by
 * colour (there are usually more places than palette colours).
 */
const LocationSpendingChart = ({ expenses }: LocationSpendingChartProps) => {
  const locationData = useMemo(() => {
    const locationTotals = expenses.reduce(
      (acc, expense) => {
        const location = expense.tagName || "No place";
        acc[location] = (acc[location] || 0) + expense.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    const total = Object.values(locationTotals).reduce((sum, val) => sum + val, 0);

    return Object.entries(locationTotals)
      .map(([name, value]) => ({
        name,
        percentage: total > 0 ? (value / total) * 100 : 0,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (locationData.length === 0) {
    return (
      <div>
        <ChartHeader title="Spending by place" />
        <ChartEmpty message="No expenses are tagged with a place" />
      </div>
    );
  }

  const max = locationData[0].value;

  return (
    <div>
      <ChartHeader
        title="Spending by place"
        description="Totals for each shop or location tag"
      />

      <ol className="space-y-3.5">
        {locationData.map((location) => (
          <li key={location.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{location.name}</span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="text-muted-foreground text-xs">
                  {location.percentage.toFixed(1)}%
                </span>
                <span className="font-semibold">{formatCurrency(location.value)}</span>
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${max > 0 ? (location.value / max) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default LocationSpendingChart;
