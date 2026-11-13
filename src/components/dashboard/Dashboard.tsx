"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  CalendarRange,
  ChartLine,
  ChevronRight,
  CircleHelp,
  Layers,
  PiggyBank,
  Plus,
  Receipt,
  Upload,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { AlertBanner } from "@/components/alerts/AlertBanner";
import { expensesData } from "@/components/expenses/data/expenseData";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { Money } from "@/components/shared/Money";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import MonthlySpendingChart from "@/components/yearly-charts/MonthlySpendingChart";
import { useYearlyExpenses } from "@/hooks/yearly-expenses/useYearlyExpenses";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";
import { getIsDemoMode } from "@/lib/supabase";
import { formatCurrency, getCategoryColor } from "@/lib/utils";

const getDemoYear = () =>
  expensesData.reduce(
    (latestYear, expense) => Math.max(latestYear, parseLocalDate(expense.date).getFullYear()),
    0,
  );

const QUICK_ACTIONS = [
  { hint: "Record what you spent", href: "/expenses", icon: Plus, label: "Add an expense" },
  { hint: "CSV or PDF", href: "/import-expenses", icon: Upload, label: "Import a statement" },
  { hint: "Limits per category", href: "/budgets", icon: PiggyBank, label: "Set budgets" },
  { hint: "Trends and reports", href: "/analytics", icon: ChartLine, label: "View analytics" },
] as const;

/** Card shell used by every panel on this page. */
function Panel({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="bg-card min-w-0 rounded-2xl p-5 shadow-md sm:p-6">
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

const Dashboard = () => {
  const isDemoMode = getIsDemoMode();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const year = isDemoMode ? getDemoYear() : currentYear;
  const { data: expenses = [], isLoading } = useYearlyExpenses(year);

  const { alerts, dismiss } = useAlerts();
  const currentMonthAlerts = alerts.filter(
    (a) => a.year === currentYear && a.month === currentMonth,
  );

  const { activeMonths, averageMonthlySpend, categoryTotals, recentExpenses, totalSpend } =
    useMemo(() => {
      const totalsByCategory = new Map<string, { amount: number; count: number }>();
      const months = new Set<number>();

      expenses.forEach((expense) => {
        const category = expense.categoryName || "Uncategorized";
        const t = totalsByCategory.get(category) ?? { amount: 0, count: 0 };
        t.amount += expense.amount;
        t.count += 1;
        totalsByCategory.set(category, t);
        months.add(parseLocalDate(expense.date).getMonth());
      });

      const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

      return {
        activeMonths: months.size,
        averageMonthlySpend: total / Math.max(months.size, 1),
        categoryTotals: [...totalsByCategory.entries()]
          .map(([name, t]) => ({ ...t, name }))
          .sort((a, b) => b.amount - a.amount),
        recentExpenses: [...expenses]
          .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
          .slice(0, 6),
        totalSpend: total,
      };
    }, [expenses]);

  if (isLoading) return <DashboardPageSkeleton />;

  const topCategory = categoryTotals[0];
  const topShare = topCategory && totalSpend > 0 ? (topCategory.amount / totalSpend) * 100 : 0;
  const maxCategory = topCategory?.amount ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={
          <>
            <span className="text-xs font-semibold tracking-wider uppercase">{year} overview</span>
            {isDemoMode && <StatusBadge>Demo data</StatusBadge>}
          </>
        }
        title="Your finances"
        description="Here’s what’s happening with your money this year."
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
          {/* Summary */}
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Total spent"
              icon={Wallet}
              value={<Money amount={totalSpend} />}
              hint={`Across ${activeMonths} active ${activeMonths === 1 ? "month" : "months"}`}
            />
            <StatCard
              label="Monthly average"
              icon={CalendarRange}
              value={<Money amount={averageMonthlySpend} />}
              hint="Based on months with spending"
            />
            <StatCard
              label="Transactions"
              icon={Receipt}
              value={expenses.length.toLocaleString()}
              hint={`Average ${formatCurrency(totalSpend / expenses.length)} each`}
            />
            <StatCard
              label="Top category"
              icon={Layers}
              value={topCategory?.name ?? "—"}
              hint={
                topCategory
                  ? `${formatCurrency(topCategory.amount)} · ${topShare.toFixed(0)}% of spending`
                  : "No category data"
              }
            />
          </section>

          {/* AI insights */}
          <AIInsightsPanel />

          {/* Trend + categories */}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
            <section className="bg-card min-w-0 rounded-2xl p-5 shadow-md sm:p-6">
              <MonthlySpendingChart
                expenses={expenses}
                year={year}
                title="Spending trend"
                description={`Monthly totals for ${year}`}
                headerExtra={
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
                }
              />
            </section>

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
                            width: `${maxCategory > 0 ? (category.amount / maxCategory) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>

          {/* Recent + quick actions */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
            <Panel
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

            <Panel title="Quick actions" description="Keep your records up to date">
              <ul className="-mx-2 space-y-1">
                {QUICK_ACTIONS.map(({ hint, href, icon: Icon, label }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="group hover:bg-muted/60 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
                    >
                      <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{label}</span>
                        <span className="text-muted-foreground block text-xs">{hint}</span>
                      </span>
                      <ChevronRight
                        className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
