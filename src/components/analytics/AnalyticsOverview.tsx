"use client";

import { memo, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CircleDollarSign,
  Info,
  Minus,
  PiggyBank,
  ReceiptText,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import { type AnalyticsOverview as Overview, budgetStatusFor } from "@/lib/analytics";
import { LOCALE_CONFIG } from "@/lib/config";
import { cn, formatCurrency } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

type MetricCardProps = {
  label: string;
  /** Plain-language definition shown in an accessible tooltip. */
  hint: string;
  icon: ReactNode;
  value: ReactNode;
  footer?: ReactNode;
};

const MetricCard = ({ footer, hint, icon, label, value }: MetricCardProps) => (
  <Card className="gap-3 py-5 shadow-none">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5">
      <div className="flex items-center gap-1.5">
        <CardDescription>{label}</CardDescription>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
              aria-label={`About ${label}`}
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-xs leading-5">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <span className="text-muted-foreground" aria-hidden>
        {icon}
      </span>
    </CardHeader>
    <CardContent className="px-5">
      <div className="truncate text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {footer && <div className="text-muted-foreground mt-1 text-xs">{footer}</div>}
    </CardContent>
  </Card>
);

/** Spending change badge: up is shown as a warning colour, down as positive. */
export const ChangeIndicator = ({
  pct,
  suffix,
}: {
  pct: number | null;
  suffix: string;
}) => {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1">
        <Minus className="size-3" aria-hidden />
        No spending to compare {suffix}
      </span>
    );
  }
  const rounded = Math.round(pct * 10) / 10;
  const up = rounded > 0;
  const flat = rounded === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium",
          !flat && up && "text-destructive",
          !flat && !up && "text-green-600 dark:text-green-400",
        )}
      >
        <Icon className="size-3" aria-hidden />
        <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"}</span>
        {Math.abs(rounded).toFixed(1)}%
      </span>
      {suffix}
    </span>
  );
};

/** Currency value with the animated ticker for non-negative amounts. */
const Money = ({ amount }: { amount: number }) =>
  amount >= 0 ? (
    <span aria-label={formatCurrency(amount)}>
      <span aria-hidden>{LOCALE_CONFIG.symbol}</span>
      <NumberTicker
        value={amount}
        decimalPlaces={2}
        className="tracking-tight text-inherit dark:text-inherit"
        aria-hidden
      />
    </span>
  ) : (
    <span>{formatCurrency(amount)}</span>
  );

const BUDGET_TONE = {
  critical: "bg-orange-500",
  over: "bg-destructive",
  under: "bg-green-600 dark:bg-green-500",
  warning: "bg-amber-500",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Overview grid
// ─────────────────────────────────────────────────────────────────────────────

type AnalyticsOverviewProps = {
  overview: Overview;
  budgetTotals: { spent: number; limit: number } | null;
  budgetsStatus: BudgetsForYearsStatus;
  /** e.g. "vs Dec 2025" */
  comparisonLabel: string;
};

const AnalyticsOverview = ({
  budgetsStatus,
  budgetTotals,
  comparisonLabel,
  overview,
}: AnalyticsOverviewProps) => {
  const mom = overview.monthOverMonth;
  const top = overview.highestCategory;
  const utilisation = overview.budgetUtilisation;

  const budgetValue = (() => {
    if (budgetsStatus === "loading") return <Skeleton className="h-8 w-24" />;
    if (budgetsStatus === "unavailable" || budgetsStatus === "error" || utilisation === null) {
      return <span className="text-muted-foreground">—</span>;
    }
    return `${utilisation.toFixed(1)}%`;
  })();

  const budgetFooter = (() => {
    if (budgetsStatus === "loading") return "Loading budgets…";
    if (budgetsStatus === "unavailable") return "Budgets are not set up yet";
    if (budgetsStatus === "error") return "Budgets could not be loaded";
    if (utilisation === null || !budgetTotals) return "No budgets in this period";
    const tone = BUDGET_TONE[budgetStatusFor(budgetTotals.spent, budgetTotals.limit)];
    return (
      <div className="space-y-1.5">
        <div
          className="bg-muted h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Budget utilisation"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.round(utilisation))}
        >
          <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.min(100, utilisation)}%` }} />
        </div>
        <span>
          {formatCurrency(budgetTotals.spent)} of {formatCurrency(budgetTotals.limit)} budgeted
        </span>
      </div>
    );
  })();

  return (
    <section aria-label="Analytics overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <MetricCard
        label="Total spending"
        hint="Sum of every expense in the selected period and categories. Refunds (negative amounts) reduce the total."
        icon={<CircleDollarSign className="size-5" />}
        value={<Money amount={overview.totalSpending} />}
        footer={<ChangeIndicator pct={overview.periodChangePct} suffix={comparisonLabel} />}
      />
      <MetricCard
        label="Average monthly spending"
        hint="Total spending divided by the number of months in the period that have started. Future months are not counted."
        icon={<CalendarRange className="size-5" />}
        value={formatCurrency(overview.averageMonthlySpending)}
        footer={`Across ${overview.monthsCounted} ${overview.monthsCounted === 1 ? "month" : "months"}`}
      />
      <MetricCard
        label="Highest spending category"
        hint="The category with the largest total spending in the selected period."
        icon={<ShoppingBag className="size-5" />}
        value={top ? top.name : <span className="text-muted-foreground">—</span>}
        footer={
          top
            ? `${formatCurrency(top.total)} · ${top.share.toFixed(0)}% of spending`
            : "No spending in this period"
        }
      />
      <MetricCard
        label="Budget utilisation"
        hint="Spending in budgeted categories and months as a share of those budgets. 80% or more is a warning; over 100% is over budget, matching spending alerts."
        icon={<PiggyBank className="size-5" />}
        value={budgetValue}
        footer={budgetFooter}
      />
      <MetricCard
        label="Transactions"
        hint="Number of expense records in the selected period and categories."
        icon={<ReceiptText className="size-5" />}
        value={overview.transactionCount.toLocaleString("en-GB")}
        footer={
          overview.transactionCount > 0
            ? `Average ${formatCurrency(overview.averageTransaction)} per transaction`
            : "No transactions in this period"
        }
      />
      <MetricCard
        label="Month-over-month"
        hint="Spending in the latest month of the period that has started, compared with the calendar month before it."
        icon={<TrendingUp className="size-5" />}
        value={
          mom ? (
            mom.changePct === null ? (
              formatCurrency(mom.change)
            ) : (
              `${mom.changePct > 0 ? "+" : ""}${mom.changePct.toFixed(1)}%`
            )
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        }
        footer={
          mom
            ? `${mom.current.label} (${formatCurrency(mom.current.total)}) vs ${mom.previous.label} (${formatCurrency(mom.previous.total)})`
            : "This period has not started yet"
        }
      />
    </section>
  );
};

export default memo(AnalyticsOverview);

export const AnalyticsOverviewSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
    {Array.from({ length: 6 }).map((_, i) => (
      <Skeleton key={i} className="h-[124px] rounded-xl" />
    ))}
  </div>
);
