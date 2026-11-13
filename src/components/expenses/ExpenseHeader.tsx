"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Layers, Receipt, TrendingUp, Wallet } from "lucide-react";

import { Money } from "@/components/shared/Money";
import { StatCard } from "@/components/shared/StatCard";
import { ExpenseWithDetails } from "@/entities/Expense";
import { CATEGORY_ICONS_BY_NAME, CHART_PALETTE, DEFAULT_MEMBERS } from "@/lib/config";
import { cn, formatCurrency, getCategoryColor } from "@/lib/utils";

import MonthYearSelector from "./MonthYearSelector";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface ExpenseHeaderProps {
  data: ExpenseWithDetails[];
  total: number;
  deltaPercent?: number | null;
  currentMonth: number;
  currentYear: number;
  onMonthYearChange: (month: number, year: number) => void;
}

interface BreakdownRow {
  amount: number;
  color: string;
  count: number;
  icon?: React.ElementType;
  name: string;
}

function BreakdownList({ rows, title, total }: { rows: BreakdownRow[]; title: string; total: number }) {
  const max = Math.max(...rows.map((r) => r.amount), 0);

  return (
    <div className="min-w-0">
      <h3 className="text-muted-foreground mb-3 text-xs font-medium">{title}</h3>
      <ul className="space-y-3.5">
        {rows.map((row) => {
          const Icon = row.icon;
          const share = total > 0 ? Math.round((row.amount / total) * 100) : 0;
          return (
            <li key={row.name} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  {Icon ? (
                    <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                  ) : (
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                  )}
                  <span className="truncate font-medium">{row.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {row.count} {row.count === 1 ? "item" : "items"}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                  <span className="text-muted-foreground text-xs">{share}%</span>
                  <Money amount={row.amount} className="font-semibold" />
                </span>
              </div>
              <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    backgroundColor: row.color,
                    width: `${max > 0 ? (row.amount / max) * 100 : 0}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ExpenseHeader = ({
  data,
  total,
  deltaPercent,
  currentMonth,
  currentYear,
  onMonthYearChange,
}: ExpenseHeaderProps) => {
  const [showBreakdown, setShowBreakdown] = useState(true);

  const categoryRows = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    data.forEach((expense) => {
      const name = expense.categoryName || "Uncategorized";
      const t = totals.get(name) ?? { amount: 0, count: 0 };
      t.amount += expense.amount;
      t.count += 1;
      totals.set(name, t);
    });
    return [...totals.entries()]
      .map(([name, t]) => ({
        ...t,
        color: name === "Uncategorized" ? "var(--muted-foreground)" : getCategoryColor(name),
        icon: CATEGORY_ICONS_BY_NAME[name] ?? CircleHelp,
        name,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  const memberRows = useMemo<BreakdownRow[]>(() => {
    const totals = new Map<string, { amount: number; count: number; name: string }>();
    data.forEach((expense) => {
      const id = expense.memberId || "unassigned";
      const name =
        id === "unassigned"
          ? "Not assigned"
          : (DEFAULT_MEMBERS.find((m) => m.id === id)?.name ?? expense.memberName ?? "Unknown");
      const t = totals.get(id) ?? { amount: 0, count: 0, name };
      t.amount += expense.amount;
      t.count += 1;
      totals.set(id, t);
    });
    return [...totals.entries()]
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([id, t], i) => ({
        ...t,
        color: id === "unassigned" ? "var(--muted-foreground)" : CHART_PALETTE[i % CHART_PALETTE.length],
      }));
  }, [data]);

  const largest = useMemo(
    () => data.reduce<ExpenseWithDetails | null>((max, e) => (!max || e.amount > max.amount ? e : max), null),
    [data],
  );

  const top = categoryRows[0];
  const prevMonthName = MONTHS[(currentMonth + 11) % 12];
  const hasData = data.length > 0;

  return (
    <section aria-label="Month summary" className="space-y-4">
      {/* Month picker */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthYearSelector
          currentMonth={currentMonth}
          currentYear={currentYear}
          onMonthYearChange={onMonthYearChange}
        />
        {hasData && (
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            aria-expanded={showBreakdown}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            {showBreakdown ? "Hide breakdown" : "Show breakdown"}
            <ChevronDown
              className={cn("size-4 transition-transform", showBreakdown && "rotate-180")}
              aria-hidden
            />
          </button>
        )}
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={`Spent in ${MONTHS[currentMonth]}`}
          icon={Wallet}
          value={<Money amount={total} />}
          delta={
            deltaPercent != null
              ? { goodDirection: "down", label: `vs ${prevMonthName}`, value: deltaPercent }
              : undefined
          }
          hint={deltaPercent == null ? `No ${prevMonthName} spending to compare` : undefined}
        />
        <StatCard
          label="Expenses"
          icon={Receipt}
          value={data.length.toLocaleString()}
          hint={hasData ? `Average ${formatCurrency(total / data.length)} each` : "Nothing recorded yet"}
        />
        <StatCard
          label="Top category"
          icon={Layers}
          value={top?.name ?? "—"}
          hint={
            top
              ? `${formatCurrency(top.amount)} · ${Math.round((top.amount / Math.max(total, 0.01)) * 100)}% of spending`
              : "No categories yet"
          }
        />
        <StatCard
          label="Largest expense"
          icon={TrendingUp}
          value={largest ? <Money amount={largest.amount} /> : "—"}
          hint={largest ? largest.description || "No description" : "Nothing recorded yet"}
        />
      </div>

      {/* Breakdown */}
      {hasData && showBreakdown && (
        <div className="bg-card grid gap-8 rounded-2xl p-5 shadow-md sm:p-6 lg:grid-cols-2">
          <BreakdownList title="By category" rows={categoryRows} total={total} />
          <BreakdownList title="Paid by" rows={memberRows} total={total} />
        </div>
      )}
    </section>
  );
};

export default ExpenseHeader;
