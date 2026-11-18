"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChartLine,
  ChevronRight,
  CircleHelp,
  Gift,
  HandCoins,
  PiggyBank,
  Plus,
  Receipt,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { AlertBanner } from "@/components/alerts/AlertBanner";
import { expensesData } from "@/components/expenses/data/expenseData";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { MoneyAtAGlance } from "@/components/money/MoneyAtAGlance";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { displayNameOf, useCurrentUser } from "@/components/providers/context/CurrentUserContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardPageSkeleton } from "@/components/shared/PageSkeletons";
import { Delta } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExpenseWithDetails } from "@/entities/Expense";
import { useYearlyExpenses } from "@/hooks/yearly-expenses/useYearlyExpenses";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency, getCategoryColor } from "@/lib/utils";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const getDemoYear = () =>
  expensesData.reduce(
    (latestYear, expense) => Math.max(latestYear, parseLocalDate(expense.date).getFullYear()),
    0,
  );

const QUICK_ACTIONS = [
  { hint: "Record what you spent", href: "/expenses", icon: Plus, label: "Add an expense" },
  { hint: "Who owes who", href: "/lend-borrow", icon: HandCoins, label: "Lend & borrow" },
  { hint: "Save up for things", href: "/wishlist", icon: Gift, label: "Wishlist" },
  { hint: "Limits per category", href: "/budgets", icon: PiggyBank, label: "Set budgets" },
  { hint: "CSV or PDF statement", href: "/import-expenses", icon: Upload, label: "Import a statement" },
  { hint: "Trends and reports", href: "/analytics", icon: ChartLine, label: "View analytics" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Client-only values (time of day, today's date). The server snapshot is used
// during hydration, so server/client time zones can never cause a mismatch.
// ─────────────────────────────────────────────────────────────────────────────

const noopSubscribe = () => () => {};

const greetingFor = (hour: number) =>
  hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

const useGreeting = () =>
  useSyncExternalStore(noopSubscribe, () => greetingFor(new Date().getHours()), () => "Welcome back");

const useTodayLabel = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", weekday: "long" }),
    () => "",
  );

// ─────────────────────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────────────────────

/** Card shell used by every panel on this page. */
function Panel({
  action,
  children,
  className,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <section className={cn("bg-card min-w-0 rounded-2xl p-5 shadow-md sm:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Twelve monthly bars; the focus month is highlighted, future months are stubs. */
function MonthBars({
  focus,
  lastStarted,
  totals,
  year,
}: {
  focus: number;
  /** Index of the latest month that has started (11 for past years). */
  lastStarted: number;
  totals: number[];
  year: number;
}) {
  const max = Math.max(0, ...totals);

  return (
    <ul aria-label={`Spending by month in ${year}`} className="flex h-32 items-end gap-1 sm:gap-2">
      {totals.map((total, i) => {
        const isFocus = i === focus;
        const isFuture = i > lastStarted;
        const height = max > 0 && total > 0 ? Math.max(6, (total / max) * 100) : 0;
        return (
          <li key={MONTHS[i]} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="group flex w-full flex-1 items-end" aria-hidden>
                  <div
                    className={cn(
                      "w-full rounded-md transition-[height,background-color] duration-500 ease-out",
                      isFocus
                        ? "bg-primary"
                        : total > 0
                          ? "bg-foreground/15 group-hover:bg-foreground/30"
                          : isFuture
                            ? "bg-muted/60"
                            : "bg-muted",
                    )}
                    style={{ height: height > 0 ? `${height}%` : "4px" }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="tabular-nums">
                {MONTHS[i]}: {isFuture ? "not started" : formatCurrency(total)}
              </TooltipContent>
            </Tooltip>
            <span
              aria-hidden
              className={cn(
                "text-[11px] leading-none",
                isFocus ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
            >
              <span className="sm:hidden">{MONTHS[i][0]}</span>
              <span className="hidden sm:inline">{MONTHS[i].slice(0, 3)}</span>
            </span>
            <span className="sr-only">
              {MONTHS[i]}: {isFuture ? "not started" : formatCurrency(total)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SummaryStat({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0 px-3 first:pl-0 last:pr-0 sm:px-5">
      <dt className="text-muted-foreground truncate text-xs">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums sm:text-base">{children}</dd>
    </div>
  );
}

function MonthRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type YearStats = {
  activeMonths: number;
  categoryTotals: { amount: number; count: number; name: string }[];
  largestByMonth: (ExpenseWithDetails | null)[];
  monthlyCounts: number[];
  monthlyTotals: number[];
  recentExpenses: ExpenseWithDetails[];
  totalSpend: number;
};

const computeStats = (expenses: ExpenseWithDetails[]): YearStats => {
  const totalsByCategory = new Map<string, { amount: number; count: number }>();
  const monthlyTotals = Array<number>(12).fill(0);
  const monthlyCounts = Array<number>(12).fill(0);
  const largestByMonth = Array<ExpenseWithDetails | null>(12).fill(null);

  for (const expense of expenses) {
    const category = expense.categoryName || "Uncategorized";
    const t = totalsByCategory.get(category) ?? { amount: 0, count: 0 };
    t.amount += expense.amount;
    t.count += 1;
    totalsByCategory.set(category, t);

    const m = parseLocalDate(expense.date).getMonth();
    monthlyTotals[m] += expense.amount;
    monthlyCounts[m] += 1;
    if (!largestByMonth[m] || expense.amount > largestByMonth[m].amount) largestByMonth[m] = expense;
  }

  return {
    activeMonths: monthlyCounts.filter((c) => c > 0).length,
    categoryTotals: [...totalsByCategory.entries()]
      .map(([name, t]) => ({ ...t, name }))
      .sort((a, b) => b.amount - a.amount),
    largestByMonth,
    monthlyCounts,
    // Round to pence so float drift never shows as "£0.00 change".
    monthlyTotals: monthlyTotals.map((v) => Math.round(v * 100) / 100),
    recentExpenses: [...expenses]
      .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
      .slice(0, 6),
    totalSpend: expenses.reduce((sum, e) => sum + e.amount, 0),
  };
};

const Dashboard = () => {
  const isDemoMode = getIsDemoMode();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = isDemoMode ? getDemoYear() : currentYear;
  const { data: expenses = [], isLoading } = useYearlyExpenses(year);

  const greeting = useGreeting();
  const todayLabel = useTodayLabel();
  const firstName = displayNameOf(useCurrentUser()).split(" ")[0];

  const { alerts, dismiss } = useAlerts();
  const currentMonthAlerts = alerts.filter(
    (a) => a.year === currentYear && a.month === currentMonth,
  );

  const stats = useMemo(() => computeStats(expenses), [expenses]);

  if (isLoading) return <DashboardPageSkeleton />;

  const {
    activeMonths,
    categoryTotals,
    largestByMonth,
    monthlyCounts,
    monthlyTotals,
    recentExpenses,
    totalSpend,
  } = stats;

  // Focus month: the current month this year, otherwise the latest month with spending.
  const isThisYear = year === currentYear;
  let lastWithSpending = 11;
  while (lastWithSpending > 0 && monthlyCounts[lastWithSpending] === 0) lastWithSpending--;
  const focus = isThisYear ? now.getMonth() : lastWithSpending;
  const lastStarted = isThisYear ? now.getMonth() : 11;
  const isCurrentMonth = isThisYear && focus === now.getMonth();

  const monthTotal = monthlyTotals[focus];
  const previousTotal = focus > 0 ? monthlyTotals[focus - 1] : null;
  const monthChange =
    previousTotal ? ((monthTotal - previousTotal) / Math.abs(previousTotal)) * 100 : null;
  const daysInFocus = new Date(year, focus + 1, 0).getDate();
  const daysElapsed = isCurrentMonth ? now.getDate() : daysInFocus;
  const dailyAverage = monthTotal / daysElapsed;
  const projected = isCurrentMonth && monthTotal > 0 ? dailyAverage * daysInFocus : null;
  const largest = largestByMonth[focus];

  const averageMonthlySpend = totalSpend / Math.max(activeMonths, 1);
  const topCategory = categoryTotals[0];
  const topShare = topCategory && totalSpend > 0 ? (topCategory.amount / totalSpend) * 100 : 0;
  const maxCategory = topCategory?.amount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-xs font-semibold tracking-wider uppercase">
              {todayLabel || `${year} overview`}
            </span>
            {isDemoMode && <StatusBadge>Demo data · {year}</StatusBadge>}
          </>
        }
        title={firstName ? `${greeting}, ${firstName}` : greeting}
        description={`Here’s where your money stands in ${year}.`}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/import-expenses">
                <Upload className="size-3.5" />
                Import
              </Link>
            </Button>
            <Button asChild size="sm" className="gap-1.5">
              <Link href="/expenses">
                All expenses
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </>
        }
      />

      {!isDemoMode && currentMonthAlerts.length > 0 && (
        <AlertBanner alerts={currentMonthAlerts} onDismiss={dismiss} showBudgetsLink />
      )}

      {/* Savings, who owes who and the wishlist — all in one row */}
      {!isDemoMode && <MoneyAtAGlance />}

      {/* New accounts: a checklist that ends in a fully set-up app */}
      {!isDemoMode && <GettingStarted />}

      {expenses.length === 0 ? (
        <EmptyState
          headingLevel="h2"
          icon={Receipt}
          title={`No expenses for ${year}`}
          description="Add an expense or import a statement to start building your spending overview."
          actions={
            <>
              <Button asChild size="sm">
                <Link href="/expenses">Add an expense</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/import-expenses">
                  <Upload className="size-3.5" />
                  Import a statement
                </Link>
              </Button>
            </>
          }
        />
      ) : (
        <>
          {/* Year + month summary */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section
              aria-labelledby="year-summary-title"
              className="bg-card flex min-w-0 flex-col rounded-2xl p-5 shadow-md sm:p-6 lg:col-span-2"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="year-summary-title" className="text-muted-foreground text-sm font-medium">
                    Spent in {year}
                  </h2>
                  <p className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">
                    <Money amount={totalSpend} />
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {expenses.length.toLocaleString("en-GB")}{" "}
                    {expenses.length === 1 ? "transaction" : "transactions"} across {activeMonths}{" "}
                    {activeMonths === 1 ? "month" : "months"}
                  </p>
                </div>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hidden h-8 gap-1 text-xs sm:inline-flex"
                >
                  <Link href="/yearly-charts">
                    Full analysis
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </Button>
              </div>

              <div className="mt-6 flex-1">
                <MonthBars focus={focus} lastStarted={lastStarted} totals={monthlyTotals} year={year} />
              </div>

              <dl className="mt-5 grid grid-cols-3 divide-x border-t pt-4">
                <SummaryStat label="Monthly average">
                  <Money amount={averageMonthlySpend} />
                </SummaryStat>
                <SummaryStat label="Avg. transaction">
                  <Money amount={totalSpend / expenses.length} />
                </SummaryStat>
                <SummaryStat label="Top category">
                  {topCategory ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        aria-hidden
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: getCategoryColor(topCategory.name) }}
                      />
                      <span className="truncate">{topCategory.name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs font-normal">
                        {topShare.toFixed(0)}%
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </SummaryStat>
              </dl>
            </section>

            <section
              aria-labelledby="month-summary-title"
              className="bg-card flex min-w-0 flex-col rounded-2xl p-5 shadow-md sm:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="month-summary-title" className="text-muted-foreground text-sm font-medium">
                    {isCurrentMonth ? `${MONTHS[focus]} so far` : `${MONTHS[focus]} ${year}`}
                  </h2>
                  <p className="mt-1.5 text-3xl font-semibold tracking-tight">
                    <Money amount={monthTotal} />
                  </p>
                </div>
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
                  <CalendarDays className="size-4" aria-hidden />
                </span>
              </div>
              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                {monthChange !== null ? (
                  <>
                    <Delta delta={{ goodDirection: "down", value: monthChange }} />
                    <span>vs {MONTHS[focus - 1]}</span>
                  </>
                ) : (
                  <span>
                    {focus === 0 ? "First month of the year" : `No spending in ${MONTHS[focus - 1]} to compare`}
                  </span>
                )}
              </div>

              {/* Pushes the details to the bottom so both summary cards line up. */}
              <div className="min-h-5 flex-1" aria-hidden />
              <dl className="space-y-3 border-t pt-4 text-sm">
                <MonthRow label="Transactions">{monthlyCounts[focus]}</MonthRow>
                <MonthRow label="Daily average">
                  <Money amount={dailyAverage} />
                </MonthRow>
                {projected !== null && (
                  <MonthRow label="On pace for">
                    <Money amount={projected} />
                  </MonthRow>
                )}
                {largest && (
                  <MonthRow label="Largest expense">
                    <Money amount={largest.amount} />
                    <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                      {largest.categoryName || "Uncategorized"}
                    </span>
                  </MonthRow>
                )}
              </dl>
            </section>
          </div>

          {/* Recent + categories */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              className="lg:col-span-2"
              title="Recent transactions"
              description="Your latest recorded expenses"
              action={
                <Button asChild variant="ghost" size="sm" className="text-muted-foreground h-8 gap-1 text-xs">
                  <Link href="/expenses">
                    View all
                    <ChevronRight className="size-3.5" />
                  </Link>
                </Button>
              }
            >
              <ul className="-mx-2 divide-y">
                {recentExpenses.map((expense) => {
                  const category = expense.categoryName || "Uncategorized";
                  const Icon = CATEGORY_ICONS_BY_NAME[category] ?? CircleHelp;
                  return (
                    <li key={expense.id} className="flex items-center justify-between gap-4 px-2 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {expense.description || "Untitled expense"}
                          </p>
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {category} ·{" "}
                            {parseLocalDate(expense.date).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      </div>
                      <Money amount={expense.amount} className="shrink-0 text-sm font-semibold" />
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel
              title="By category"
              description="Where your money is going"
              action={
                categoryTotals.length > 6 ? (
                  <Button asChild variant="ghost" size="sm" className="text-muted-foreground h-8 gap-1 text-xs">
                    <Link href="/yearly-charts">
                      See all
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              <ul className="space-y-4">
                {categoryTotals.slice(0, 6).map((category) => {
                  const Icon = CATEGORY_ICONS_BY_NAME[category.name] ?? CircleHelp;
                  const share = totalSpend > 0 ? (category.amount / totalSpend) * 100 : 0;
                  const color =
                    category.name === "Uncategorized"
                      ? "var(--muted-foreground)"
                      : getCategoryColor(category.name);
                  return (
                    <li key={category.name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                          <span className="truncate font-medium">{category.name}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                          <span className="text-muted-foreground text-xs">{share.toFixed(0)}%</span>
                          <Money amount={category.amount} className="font-semibold" />
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 overflow-hidden rounded-full" aria-hidden>
                        <div
                          className="h-full rounded-full transition-[width] duration-700"
                          style={{
                            backgroundColor: color,
                            width: `${maxCategory > 0 ? Math.max(0, (category.amount / maxCategory) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          {/* AI insights */}
          <AIInsightsPanel />

          {/* Quick actions */}
          <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {QUICK_ACTIONS.map(({ hint, href, icon: Icon, label }) => (
              <Link
                key={label}
                href={href}
                className="group bg-card hover:bg-muted/40 flex items-center gap-3 rounded-2xl p-4 shadow-md transition-colors"
              >
                <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground block truncate text-xs">{hint}</span>
                </span>
                <ChevronRight
                  className="text-muted-foreground hidden size-4 shrink-0 transition-transform group-hover:translate-x-0.5 sm:block"
                  aria-hidden
                />
              </Link>
            ))}
          </section>
        </>
      )}
    </div>
  );
};

export default Dashboard;
