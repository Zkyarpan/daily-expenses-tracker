"use client";

import { useMemo } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExpenseWithDetails } from "@/entities/Expense";
import { formatCurrency } from "@/lib/utils";

import { ChartEmpty, ChartHeader } from "./ChartHeader";

interface MemberCategoryHeatmapProps {
  expenses: ExpenseWithDetails[];
}

// One sequential scale built from the theme's first chart colour. Capped at
// 80 % so the foreground text stays readable on every step in both themes.
const SCALE = [16, 30, 45, 62, 80] as const;

const shade = (step: number) => `color-mix(in oklch, var(--chart-1) ${step}%, transparent)`;

const stepFor = (ratio: number) => {
  if (ratio > 0.8) return SCALE[4];
  if (ratio > 0.6) return SCALE[3];
  if (ratio > 0.4) return SCALE[2];
  if (ratio > 0.2) return SCALE[1];
  return SCALE[0];
};

const MemberCategoryHeatmap = ({ expenses }: MemberCategoryHeatmapProps) => {
  const { categories, heatmapData, memberMaxValues, members, memberTotals } = useMemo(() => {
    const dataMap: Record<string, Record<string, number>> = {};

    expenses.forEach((expense) => {
      const member = expense.memberName || "Unassigned";
      const category = expense.categoryName || "Uncategorized";
      dataMap[member] ??= {};
      dataMap[member][category] = (dataMap[member][category] || 0) + expense.amount;
    });

    const uniqueMembers = Object.keys(dataMap).sort();
    const uniqueCategories = Array.from(
      new Set(expenses.map((e) => e.categoryName || "Uncategorized")),
    ).sort();

    const maxMap: Record<string, number> = {};
    const totalMap: Record<string, number> = {};
    uniqueMembers.forEach((member) => {
      const values = Object.values(dataMap[member]);
      maxMap[member] = Math.max(0, ...values);
      totalMap[member] = values.reduce((sum, v) => sum + v, 0);
    });

    return {
      categories: uniqueCategories,
      heatmapData: dataMap,
      memberMaxValues: maxMap,
      memberTotals: totalMap,
      members: uniqueMembers,
    };
  }, [expenses]);

  if (members.length === 0 || categories.length === 0) {
    return (
      <div>
        <ChartHeader title="Member × category" />
        <ChartEmpty />
      </div>
    );
  }

  return (
    <div>
      <ChartHeader
        title="Member × category"
        description="Darker cells are a larger share of that person's spending"
      />

      <div className="overflow-x-auto rounded-xl border">
        <TooltipProvider delayDuration={100}>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-muted-foreground w-[150px] font-sans text-xs font-medium">
                  Member
                </TableHead>
                {categories.map((category) => (
                  <TableHead
                    key={category}
                    className="text-muted-foreground min-w-[92px] text-center font-sans text-xs font-medium"
                  >
                    {category}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member} className="hover:bg-transparent">
                  <TableCell className="font-sans">
                    <div className="text-sm font-medium">{member}</div>
                    <div className="text-muted-foreground text-xs tabular-nums">
                      {formatCurrency(memberTotals[member])}
                    </div>
                  </TableCell>
                  {categories.map((category) => {
                    const value = heatmapData[member]?.[category] || 0;
                    const max = memberMaxValues[member];
                    const ratio = max > 0 ? value / max : 0;

                    return (
                      <TableCell key={`${member}-${category}`} className="p-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              tabIndex={0}
                              aria-label={`${member}, ${category}: ${formatCurrency(value)}`}
                              className={`flex h-12 items-center justify-center rounded-lg text-xs font-medium tabular-nums transition-[filter] hover:brightness-110 ${
                                value > 0 ? "text-foreground" : "bg-muted/40 text-muted-foreground"
                              }`}
                              style={value > 0 ? { backgroundColor: shade(stepFor(ratio)) } : undefined}
                            >
                              {value > 0
                                ? formatCurrency(value, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
                                : "—"}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-0.5 text-xs">
                              <p className="font-semibold">
                                {member} · {category}
                              </p>
                              <p className="tabular-nums">{formatCurrency(value)}</p>
                              {max > 0 && (
                                <p className="opacity-70">
                                  {Math.round(ratio * 100)}% of {member}&apos;s top category
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>

      <div className="text-muted-foreground mt-4 flex items-center justify-end gap-2 text-xs">
        <span>Lower</span>
        <div className="flex gap-1" aria-hidden>
          {SCALE.map((step) => (
            <span
              key={step}
              className="size-4 rounded"
              style={{ backgroundColor: shade(step) }}
            />
          ))}
        </div>
        <span>Higher</span>
      </div>
    </div>
  );
};

export default MemberCategoryHeatmap;
