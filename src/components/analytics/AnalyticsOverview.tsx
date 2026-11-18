"use client";

import { memo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Info,
  Layers,
  Minus,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Meter, type MeterTone } from "@/components/shared/Meter";
import { Money } from "@/components/shared/Money";
import { StatCard } from "@/components/shared/StatCard";
import { NumberTicker } from "@/components/ui/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import {
  type AnalyticsOverview as Overview,
  type BudgetStatus,
  budgetStatusFor,
} from "@/lib/analytics";
import { LOCALE_CONFIG } from "@/lib/config";
import { cn, formatCurrency, getCategoryColor } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

/** Card label with a plain-language definition in an accessible tooltip. */
const InfoLabel = ({ hint, label }: { label: string; hint: string }) => (
  <span className="inline-flex items-center gap-1">
    {label}
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
          aria-label={`About ${label}`}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs leading-5">{hint}</TooltipContent>
    </Tooltip>
  </span>
);

/** Currency total with the animated ticker for non-negative amounts. */
const AnimatedMoney = ({ amount }: { amount: number }) =>
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
    <Money amount={amount} />
  );

/** Signed percentage with an arrow: spending up is red, down is green. */
const ChangeValue = ({ pct }: { pct: number }) => {
  const rounded = Math.round(pct * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        direction === "up" && "text-destructive",
        direction === "down" && "text-success",
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="sr-only">{direction === "flat" ? "No change" : direction === "up" ? "Up" : "Down"}</span>
      {direction === "up" ? "+" : direction === "down" ? "−" : ""}
      {Math.abs(rounded).toFixed(1)}%
    </span>
  );
};

/** Same thresholds as spending alerts and the budget report's status badges. */
const BUDGET_METER_TONE: Record<BudgetStatus, MeterTone> = {
  critical: "warning",
  over: "critical",
  under: "success",
  warning: "warning",
};

const Dash = () => <span className="text-muted-foreground">—</span>;

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
  const hasBudgetData =
    budgetsStatus !== "loading" &&
    budgetsStatus !== "unavailable" &&
    budgetsStatus !== "error" &&
    utilisation !== null &&
    !!budgetTotals;

  const budgetValue = (() => {
    if (budgetsStatus === "loading") return <Skeleton className="h-7 w-20" />;
    if (!hasBudgetData) return <Dash />;
    return `${utilisation.toFixed(1)}%`;
  })();

  const budgetHint = (() => {
    if (budgetsStatus === "loading") return "Loading budgets…";
    if (budgetsStatus === "unavailable") return "Budgets are not set up yet";
    if (budgetsStatus === "error") return "Budgets could not be loaded";
    if (!hasBudgetData) return "No budgets in this period";
    return undefined;
  })();

  return (
    <section aria-label="Analytics overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
      <StatCard
        label={
          <InfoLabel
            label="Total spending"
            hint="Sum of every expense in the selected period and categories. Refunds (negative amounts) reduce the total."
          />
        }
        icon={Wallet}
        value={<AnimatedMoney amount={overview.totalSpending} />}
        delta={
          overview.periodChangePct === null
            ? undefined
            : { goodDirection: "down", label: comparisonLabel, value: overview.periodChangePct }
        }
        hint={overview.periodChangePct === null ? `No spending to compare ${comparisonLabel}` : undefined}
      />

      <StatCard
        label={
          <InfoLabel
            label="Monthly average"
            hint="Total spending divided by the number of months in the period that have started. Future months are not counted."
          />
        }
        icon={CalendarRange}
        value={<Money amount={overview.averageMonthlySpending} />}
        hint={`Across ${overview.monthsCounted} ${overview.monthsCounted === 1 ? "month" : "months"}`}
      />

      <StatCard
        label={
          <InfoLabel
            label="Top category"
            hint="The category with the largest total spending in the selected period."
          />
        }
        icon={Layers}
        value={top ? top.name : <Dash />}
        hint={
          top ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: getCategoryColor(top.name) }}
                aria-hidden
              />
              {formatCurrency(top.total)} · {top.share.toFixed(0)}% of spending
            </span>
          ) : (
            "No spending in this period"
          )
        }
      />

      <StatCard
        label={
          <InfoLabel
            label="Budget used"
            hint="Spending in budgeted categories and months as a share of those budgets. 80% or more is a warning; over 100% is over budget, matching spending alerts."
          />
        }
        icon={PiggyBank}
        value={budgetValue}
        hint={budgetHint}
      >
        {hasBudgetData && (
          <div className="mt-auto space-y-2 pt-0.5">
            <Meter
              size="sm"
              label="Budget used"
              value={utilisation}
              tone={BUDGET_METER_TONE[budgetStatusFor(budgetTotals.spent, budgetTotals.limit)]}
              valueText={`${formatCurrency(budgetTotals.spent)} of ${formatCurrency(budgetTotals.limit)} spent`}
            />
            <p className="text-muted-foreground text-xs tabular-nums">
              {formatCurrency(budgetTotals.spent)} of {formatCurrency(budgetTotals.limit)}
            </p>
          </div>
        )}
      </StatCard>

      <StatCard
        label={
          <InfoLabel
            label="Transactions"
            hint="Number of expense records in the selected period and categories."
          />
        }
        icon={Receipt}
        value={overview.transactionCount.toLocaleString("en-GB")}
        hint={
          overview.transactionCount > 0
            ? `Average ${formatCurrency(overview.averageTransaction)} each`
            : "No transactions in this period"
        }
      />

      <StatCard
        label={
          <InfoLabel
            label="Month over month"
            hint="Spending in the latest month of the period that has started, compared with the calendar month before it."
          />
        }
        icon={TrendingUp}
        value={
          !mom ? (
            <Dash />
          ) : mom.changePct === null ? (
            <Money amount={mom.change} signed />
          ) : (
            <ChangeValue pct={mom.changePct} />
          )
        }
        hint={
          mom
            ? `${mom.current.label} ${formatCurrency(mom.current.total)} vs ${mom.previous.label} ${formatCurrency(mom.previous.total)}`
            : "This period has not started yet"
        }
      />
    </section>
  );
};

export default memo(AnalyticsOverview);
