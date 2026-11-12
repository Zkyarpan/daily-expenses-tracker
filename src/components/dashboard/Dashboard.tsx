"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ReceiptText,
  ShoppingBag,
  Upload,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { AlertBanner } from "@/components/alerts/AlertBanner";
import { expensesData } from "@/components/expenses/data/expenseData";
import { AIInsightsPanel } from "@/components/insights/AIInsightsPanel";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MonthlySpendingChart from "@/components/yearly-charts/MonthlySpendingChart";
import type { ExpenseWithDetails } from "@/entities/Expense";
import { useYearlyExpenses } from "@/hooks/yearly-expenses/useYearlyExpenses";
import { DEFAULT_CATEGORIES, LOCALE_CONFIG } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";
import { getIsDemoMode } from "@/lib/supabase";
import { formatCurrency, getCategoryColor } from "@/lib/utils";

const currency = new Intl.NumberFormat(LOCALE_CONFIG.locale, {
  currency: LOCALE_CONFIG.currency,
  maximumFractionDigits: 2,
  style: "currency",
});

const getDemoYear = () =>
  expensesData.reduce(
    (latestYear, expense) =>
      Math.max(latestYear, parseLocalDate(expense.date).getFullYear()),
    0,
  );

const DashboardSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-72" />
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-xl" />
      ))}
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
      <Skeleton className="h-[390px] rounded-xl" />
      <Skeleton className="h-[390px] rounded-xl" />
    </div>
  </div>
);

const EmptyDashboard = ({ year }: { year: number }) => (
  <Card className="border-dashed shadow-none">
    <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary mb-5 flex size-14 items-center justify-center rounded-2xl">
        <ReceiptText className="size-7" />
      </div>
      <h2 className="text-lg font-semibold">No expenses recorded for {year}</h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm leading-6">
        Add an expense or import a statement to start building your spending
        overview. Your summaries and charts will appear here automatically.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/expenses">Manage expenses</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/import-expenses">
            <Upload className="mr-2 size-4" />
            Import a statement
          </Link>
        </Button>
      </div>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const isDemoMode = getIsDemoMode();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-based
  const year = isDemoMode ? getDemoYear() : currentYear;
  const { data: expenses = [], isLoading } = useYearlyExpenses(year);

  // Spending alerts for the current month (from shared context)
  const { alerts, dismiss } = useAlerts();
  const currentMonthAlerts = alerts.filter(
    (a) => a.year === currentYear && a.month === currentMonth,
  );

  const {
    activeMonths,
    averageMonthlySpend,
    categoryTotals,
    recentExpenses,
    totalSpend,
  } = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    const totalsByMonth = new Set<number>();

    expenses.forEach((expense) => {
      const date = parseLocalDate(expense.date);
      const category = expense.categoryName || "Uncategorized";

      totalsByCategory.set(
        category,
        (totalsByCategory.get(category) || 0) + expense.amount,
      );
      totalsByMonth.add(date.getMonth());
    });

    const categoryTotals = Array.from(totalsByCategory.entries())
      .map(([name, amount]) => ({ amount, name }))
      .sort((a, b) => b.amount - a.amount);
    const totalSpend = expenses.reduce((total, expense) => total + expense.amount, 0);

    return {
      activeMonths: totalsByMonth.size,
      averageMonthlySpend: totalSpend / Math.max(totalsByMonth.size, 1),
      categoryTotals,
      recentExpenses: [...expenses]
        .sort(
          (a, b) =>
            parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime(),
        )
        .slice(0, 5),
      totalSpend,
    };
  }, [expenses]);

  const topCategory = categoryTotals[0];
  const topCategoryShare = topCategory ? (topCategory.amount / totalSpend) * 100 : 0;

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-muted-foreground mb-2 flex items-center gap-2 text-sm">
            <CalendarDays className="size-4" />
            <span>{year} overview</span>
            {isDemoMode && <Badge variant="secondary">Demo data</Badge>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            A clear view of where your money is going.
          </p>
        </div>
        <Button asChild>
          <Link href="/expenses">
            View expenses
            <ArrowUpRight className="ml-2 size-4" />
          </Link>
        </Button>
      </div>

      {/* Spending alerts banner — shown when there are active alerts for this month */}
      {!isDemoMode && currentMonthAlerts.length > 0 && (
        <AlertBanner
          alerts={currentMonthAlerts}
          onDismiss={dismiss}
          showBudgetsLink
        />
      )}

      {expenses.length === 0 ? (
        <EmptyDashboard year={year} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardDescription>Total spend</CardDescription>
                <CircleDollarSign className="text-muted-foreground size-5" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">
                  {currency.format(totalSpend)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Across {activeMonths} active {activeMonths === 1 ? "month" : "months"}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardDescription>Monthly average</CardDescription>
                <WalletCards className="text-muted-foreground size-5" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">
                  {currency.format(averageMonthlySpend)}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Based on recorded activity</p>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardDescription>Transactions</CardDescription>
                <ReceiptText className="text-muted-foreground size-5" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">{expenses.length}</p>
                <p className="text-muted-foreground mt-1 text-xs">Recorded expenses</p>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardDescription>Top category</CardDescription>
                <ShoppingBag className="text-muted-foreground size-5" />
              </CardHeader>
              <CardContent>
                <p className="truncate text-2xl font-semibold tracking-tight">
                  {topCategory?.name || "—"}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {topCategory
                    ? `${topCategoryShare.toFixed(0)}% of total spend`
                    : "No category data"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Feature 7: AI spending insights */}
          <AIInsightsPanel />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.75fr)]">
            <Card className="min-w-0 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Spending trend</CardTitle>
                  <CardDescription className="mt-1">
                    Monthly totals for {year}
                  </CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm" className="shrink-0">
                  <Link href="/yearly-charts">
                    Full analysis
                    <ArrowUpRight className="ml-1 size-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <MonthlySpendingChart expenses={expenses} year={year} />
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader>
                <CardTitle>Spending by category</CardTitle>
                <CardDescription>Where your spending is concentrated</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {categoryTotals.slice(0, 5).map((category) => {
                  const percentage = (category.amount / totalSpend) * 100;
                  const matchedCategory = DEFAULT_CATEGORIES.find(
                    (item) => item.name === category.name,
                  );

                  return (
                    <div key={category.name} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: getCategoryColor(category.name) }}
                          />
                          <span className="truncate font-medium">
                            {matchedCategory?.name || category.name}
                          </span>
                        </div>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatCurrency(category.amount)}
                        </span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            backgroundColor: getCategoryColor(category.name),
                            width: `${percentage}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {categoryTotals.length > 5 && (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/yearly-charts">
                      See all categories
                      <BarChart3 className="ml-2 size-4" />
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
            <Card className="shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>Recent transactions</CardTitle>
                  <CardDescription>Your latest recorded expenses</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/expenses">View all</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="divide-border divide-y">
                  {recentExpenses.map((expense: ExpenseWithDetails) => (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <ReceiptText className="text-muted-foreground size-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {expense.description || "Untitled expense"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {expense.categoryName || "Uncategorized"} · {parseLocalDate(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCurrency(expense.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/[0.03] shadow-none">
              <CardHeader>
                <CardTitle>Keep your records current</CardTitle>
                <CardDescription>
                  Add an expense or bring in a statement to keep this overview accurate.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Button asChild className="w-full justify-between">
                  <Link href="/expenses">
                    Manage expenses
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-between">
                  <Link href="/import-expenses">
                    Import expenses
                    <Upload className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
