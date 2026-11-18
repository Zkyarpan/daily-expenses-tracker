"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Camera,
  ChevronRight,
  CircleHelp,
  MessagesSquare,
  Plus,
  Receipt,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";

import { AlertBanner } from "@/components/alerts/AlertBanner";
import { expensesData } from "@/components/expenses/data/expenseData";
import { useHelp } from "@/components/help/HelpCenter";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { MoneyAtAGlance } from "@/components/money/MoneyAtAGlance";
import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { displayNameOf, useCurrentUser } from "@/components/providers/context/CurrentUserContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { DashboardPageSkeleton } from "@/components/shared/PageSkeletons";
import { Delta } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ExpenseWithDetails } from "@/entities/Expense";
import { useYearlyExpenses } from "@/hooks/yearly-expenses/useYearlyExpenses";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";
import { MONEY_QUESTIONS } from "@/lib/help/topics";
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

/** "Today", "Yesterday" or "Wed 24 Dec" for a YYYY-MM-DD key (client-only). */
const useDayLabel = () => {
  const todayKey = useSyncExternalStore(noopSubscribe, () => new Date().toDateString(), () => "");
  return (date: Date) => {
    if (todayKey) {
      const today = new Date(todayKey);
      const diff = Math.round((today.getTime() - new Date(date.toDateString()).getTime()) / 86_400_000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Yesterday";
    }
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", weekday: "short" });
  };
};

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
    <section className={cn("bg-card min-w-0 rounded-2xl p-4 shadow-md sm:p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-4 sm:mb-5">
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

function PanelLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="text-muted-foreground -mr-2 h-8 shrink-0 gap-1 text-xs">
      <Link href={href}>
        {children}
        <ChevronRight className="size-3.5" />
      </Link>
    </Button>
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
    <ul aria-label={`Spending by month in ${year}`} className="flex h-36 items-end gap-1 sm:gap-2">
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

function Stat({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="bg-muted/50 min-w-0 rounded-xl px-3 py-2.5">
      <dt className="text-muted-foreground text-xs leading-tight">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums sm:text-base">{children}</dd>
    </div>
  );
}

function DetailRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** Big, tappable action tile used in the hero. */
function ActionTile({
  className,
  hint,
  href,
  icon: Icon,
  label,
  onClick,
}: {
  className?: string;
  hint: string;
  href?: string;
  icon: typeof Plus;
  label: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className="bg-background/70 text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-snug font-semibold">{label}</span>
        <span className="text-muted-foreground block text-xs sm:truncate">{hint}</span>
      </span>
    </>
  );
  // Phones: icon above the text so labels never squeeze; side by side from sm.
  const classes = cn(
    "bg-muted/60 hover:bg-muted focus-visible:ring-ring flex min-h-16 flex-col items-start gap-2 rounded-2xl p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-3",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {body}
    </button>
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
      .slice(0, 7),
    totalSpend: expenses.reduce((sum, e) => sum + e.amount, 0),
  };
};

/**
 * Home: a hero with this month's number and the main actions, then a
 * two-column body — the year and recent activity on the left, categories,
 * month details and "ask about your money" on the right — and AI insights.
 */
const Dashboard = () => {
  const isDemoMode = getIsDemoMode();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const year = isDemoMode ? getDemoYear() : currentYear;
  const { data: expenses = [], isLoading } = useYearlyExpenses(year);

  const greeting = useGreeting();
  const todayLabel = useTodayLabel();
  const dayLabel = useDayLabel();
  const firstName = displayNameOf(useCurrentUser()).split(" ")[0];
  const { openExpense, openReceiptScan } = useQuickAdd();
  const { openHelp } = useHelp();

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
  const maxCategory = categoryTotals[0]?.amount ?? 0;

  // Recent activity grouped under day headings.
  const recentByDay: { expenses: ExpenseWithDetails[]; label: string }[] = [];
  for (const expense of recentExpenses) {
    const label = dayLabel(parseLocalDate(expense.date));
    const last = recentByDay.at(-1);
    if (last?.label === label) last.expenses.push(expense);
    else recentByDay.push({ expenses: [expense], label });
  }

  const monthLabel = isCurrentMonth ? `${MONTHS[focus]} so far` : `${MONTHS[focus]} ${year}`;

  return (
    <div className="space-y-6">
      {/* ── Hero: greeting, this month's number, main actions ─────────────── */}
      <section
        aria-labelledby="home-title"
        className="bg-card relative overflow-hidden rounded-3xl p-5 shadow-md sm:p-8"
      >
        {/* Soft brand glow, decorative only. */}
        <div
          aria-hidden
          className="bg-primary/15 pointer-events-none absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
        />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
          <div className="min-w-0">
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wider uppercase">
              <span>{todayLabel || `${year} overview`}</span>
              {isDemoMode && <StatusBadge>Demo data · {year}</StatusBadge>}
            </div>
            <h1 id="home-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {firstName ? `${greeting}, ${firstName}` : greeting}
            </h1>

            {expenses.length > 0 ? (
              <>
                <p className="text-muted-foreground mt-5 text-sm">Spent in {monthLabel}</p>
                <p className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                  <Money amount={monthTotal} />
                </p>
                <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  {monthChange !== null ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Delta delta={{ goodDirection: "down", value: monthChange }} />
                      vs {MONTHS[focus - 1]}
                    </span>
                  ) : (
                    <span>{focus === 0 ? "First month of the year" : `Nothing in ${MONTHS[focus - 1]} to compare`}</span>
                  )}
                  <span aria-hidden className="bg-border h-3 w-px" />
                  <span>
                    <Money amount={dailyAverage} className="text-foreground font-medium" /> a day
                  </span>
                  {projected !== null && (
                    <>
                      <span aria-hidden className="bg-border h-3 w-px" />
                      <span>
                        On pace for <Money amount={projected} className="text-foreground font-medium" />
                      </span>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm">Add your first expense to see where your money goes.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <ActionTile icon={Plus} label="Add expense" hint="Takes seconds" onClick={openExpense} />
            {isDemoMode ? (
              <ActionTile icon={Upload} label="Import" hint="CSV or PDF" href="/import-expenses" />
            ) : (
              <ActionTile icon={Camera} label="Scan receipt" hint="AI fills it in" onClick={openReceiptScan} />
            )}
            <ActionTile icon={Receipt} label="All expenses" hint="Search & edit" href="/expenses" />
            <ActionTile icon={Sparkles} label="Ask AI" hint="About your money" href="/assistant" />
          </div>
        </div>
      </section>

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
              <Button size="sm" onClick={openExpense}>
                Add an expense
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
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ── Main column ───────────────────────────────────────────── */}
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <Panel
                title={`${year} at a glance`}
                description={`${expenses.length.toLocaleString("en-GB")} ${expenses.length === 1 ? "transaction" : "transactions"} across ${activeMonths} ${activeMonths === 1 ? "month" : "months"}`}
                action={<PanelLink href="/yearly-charts">Full analysis</PanelLink>}
              >
                <p className="-mt-2 mb-5 text-3xl font-semibold tracking-tight">
                  <Money amount={totalSpend} />
                </p>
                <MonthBars focus={focus} lastStarted={lastStarted} totals={monthlyTotals} year={year} />
                <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Stat label="Monthly average">
                    <Money amount={averageMonthlySpend} />
                  </Stat>
                  <Stat label="Average expense">
                    <Money amount={totalSpend / expenses.length} />
                  </Stat>
                  <Stat label="Biggest month">
                    {MONTHS[monthlyTotals.indexOf(Math.max(...monthlyTotals))].slice(0, 3)}{" "}
                    <span className="text-muted-foreground text-xs font-normal">
                      <Money amount={Math.max(...monthlyTotals)} compact />
                    </span>
                  </Stat>
                </dl>
              </Panel>

              <Panel
                title="Recent activity"
                description="Your latest expenses"
                action={<PanelLink href="/expenses">View all</PanelLink>}
              >
                <div className="space-y-4">
                  {recentByDay.map((day) => (
                    <div key={day.label}>
                      <h3 className="text-muted-foreground mb-1 text-xs font-semibold">{day.label}</h3>
                      <ul className="-mx-2 divide-y">
                        {day.expenses.map((expense) => {
                          const category = expense.categoryName || "Uncategorized";
                          const Icon = CATEGORY_ICONS_BY_NAME[category] ?? CircleHelp;
                          return (
                            <li key={expense.id} className="flex items-center justify-between gap-4 px-2 py-2.5">
                              <div className="flex min-w-0 items-center gap-3">
                                <span
                                  className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                                  style={{
                                    backgroundColor: `color-mix(in oklch, ${category === "Uncategorized" ? "var(--muted-foreground)" : getCategoryColor(category)} 16%, transparent)`,
                                  }}
                                >
                                  <Icon className="text-foreground/80 size-4" aria-hidden />
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {expense.description || "Untitled expense"}
                                  </p>
                                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                    {category}
                                    {expense.memberName ? ` · ${expense.memberName}` : ""}
                                  </p>
                                </div>
                              </div>
                              <Money amount={expense.amount} className="shrink-0 text-sm font-semibold" />
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* ── Side column ───────────────────────────────────────────── */}
            <div className="min-w-0 space-y-6">
              <Panel
                title="Top categories"
                description={`Where your money went in ${year}`}
                action={categoryTotals.length > 5 ? <PanelLink href="/yearly-charts">See all</PanelLink> : undefined}
              >
                <ul className="space-y-4">
                  {categoryTotals.slice(0, 5).map((category) => {
                    const Icon = CATEGORY_ICONS_BY_NAME[category.name] ?? CircleHelp;
                    const share = totalSpend > 0 ? (category.amount / totalSpend) * 100 : 0;
                    const color =
                      category.name === "Uncategorized" ? "var(--muted-foreground)" : getCategoryColor(category.name);
                    return (
                      <li key={category.name} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
                            <span className="truncate font-medium">{category.name}</span>
                            <span className="text-muted-foreground shrink-0 text-xs">{share.toFixed(0)}%</span>
                          </span>
                          <Money amount={category.amount} className="shrink-0 font-semibold" />
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

              <Panel title={monthLabel} description="This month in detail">
                <dl className="space-y-3 text-sm">
                  <DetailRow label="Transactions">{monthlyCounts[focus]}</DetailRow>
                  <DetailRow label="Daily average">
                    <Money amount={dailyAverage} />
                  </DetailRow>
                  {projected !== null && (
                    <DetailRow label="On pace for">
                      <Money amount={projected} />
                    </DetailRow>
                  )}
                  {largest && (
                    <DetailRow label="Largest expense">
                      <Money amount={largest.amount} />
                      <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                        {largest.categoryName || "Uncategorized"}
                      </span>
                    </DetailRow>
                  )}
                </dl>
              </Panel>

              {/* Asks the user a question — answers come from their own data. */}
              <section className="bg-primary/8 min-w-0 rounded-2xl p-4 sm:p-5">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <MessagesSquare className="text-primary size-4" aria-hidden />
                  What would you like to know?
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {MONEY_QUESTIONS.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => openHelp(q)}
                      className="bg-card hover:bg-muted focus-visible:ring-ring rounded-full border px-3 py-1.5 text-left text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <Link
                  href="/help"
                  className="text-muted-foreground hover:text-foreground mt-3 inline-flex items-center gap-1 text-xs"
                >
                  Help &amp; FAQs
                  <ArrowUpRight className="size-3" aria-hidden />
                </Link>
              </section>
            </div>
          </div>

          {/* AI insights */}
          <AIInsightsPanel />
        </>
      )}
    </div>
  );
};

export default Dashboard;
