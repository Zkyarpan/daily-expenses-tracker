"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronDown,
  FileSpreadsheet,
  Layers,
  Printer,
  Receipt,
  Upload,
  Wallet,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { DataTable } from "@/app/(protected)/expenses/data-table";
import { expensesData } from "@/components/expenses/data/expenseData";
import { ExpenseMobileRow } from "@/components/expenses/ExpenseMobileRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { YearlyChartsPageSkeleton } from "@/components/shared/PageSkeletons";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryFilter from "@/components/yearly-charts/CategoryFilter";
import MonthFilter from "@/components/yearly-charts/MonthFilter";
import YearSelector from "@/components/YearSelector";
import { useYearlyExpenses } from "@/hooks/yearly-expenses/useYearlyExpenses";
import { parseLocalDate } from "@/lib/dateUtils";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

import { createReadOnlyColumns } from "./columns";

const ChartsGridSkeleton = () => (
  <div className="grid gap-4 lg:grid-cols-2" aria-hidden>
    <Skeleton className="h-[380px] rounded-2xl lg:col-span-2" />
    <Skeleton className="h-[340px] rounded-2xl" />
    <Skeleton className="h-[340px] rounded-2xl" />
  </div>
);

// Recharts is only loaded when the page renders charts.
const YearlyChartsGrid = dynamic(
  () => import("@/components/yearly-charts/YearlyChartsGrid"),
  { loading: () => <ChartsGridSkeleton />, ssr: false },
);

const isDemoMode = getIsDemoMode();

// Demo data is a fixed historical year, so open on that year instead of an
// empty current year.
const initialYear = () =>
  isDemoMode
    ? expensesData.reduce(
        (latest, e) => Math.max(latest, parseLocalDate(e.date).getFullYear()),
        0,
      ) || new Date().getFullYear()
    : new Date().getFullYear();

async function handleExportExcel(
  expenses: Parameters<typeof import("@/lib/exportExcel").exportToExcel>[0],
  year: number,
) {
  const { exportToExcel } = await import("@/lib/exportExcel");
  return exportToExcel(expenses, year);
}

const YearlyChartsPage = () => {
  const [currentYear, setCurrentYear] = useState(initialYear);
  const { data: expenses = [], isLoading } = useYearlyExpenses(currentYear);

  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showTable, setShowTable] = useState(false);

  const allCategories = useMemo(
    () =>
      Array.from(new Set(expenses.map((e) => e.categoryName || "Uncategorized"))).sort(),
    [expenses],
  );

  const effectiveCategories = useMemo(
    () => (selectedCategories.length > 0 ? selectedCategories : allCategories),
    [selectedCategories, allCategories],
  );

  const filteredYearExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const category = expense.categoryName || "Uncategorized";
        const month = parseLocalDate(expense.date as unknown as string).getMonth();
        const categoryMatch =
          effectiveCategories.length === 0 || effectiveCategories.includes(category);
        const monthMatch = selectedMonths.length === 0 || selectedMonths.includes(month);
        return categoryMatch && monthMatch;
      }),
    [expenses, effectiveCategories, selectedMonths],
  );

  const columns = useMemo(() => createReadOnlyColumns(), []);

  const summary = useMemo(() => {
    const total = filteredYearExpenses.reduce((sum, e) => sum + e.amount, 0);
    const months = new Set<number>();
    const byCategory = new Map<string, number>();
    filteredYearExpenses.forEach((e) => {
      months.add(parseLocalDate(e.date as unknown as string).getMonth());
      const category = e.categoryName || "Uncategorized";
      byCategory.set(category, (byCategory.get(category) || 0) + e.amount);
    });
    const [topName, topAmount] =
      [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    return {
      activeMonths: months.size,
      average: total / Math.max(months.size, 1),
      topAmount: topAmount ?? 0,
      topName,
      total,
    };
  }, [filteredYearExpenses]);

  const categoriesFiltered =
    selectedCategories.length > 0 && selectedCategories.length < allCategories.length;
  const isFiltered = selectedMonths.length > 0 || categoriesFiltered;

  const clearFilters = () => {
    setSelectedMonths([]);
    setSelectedCategories([]);
  };

  const handleExportPdf = () => {
    const originalTitle = document.title;
    const html = document.documentElement;
    const originalClass = html.className;
    document.title = `daily-expenses-${currentYear}-report`;
    html.className = originalClass.replace("dark", "").trim();
    setTimeout(() => {
      window.print();
      html.className = originalClass;
      document.title = originalTitle;
    }, 150);
  };

  const hasData = expenses.length > 0;

  return (
    <div className="space-y-6">
      <ScrollProgress className="print:hidden" />

      {/* Print-only title */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Expense analytics: {currentYear}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Total: {formatCurrency(summary.total)} · {filteredYearExpenses.length} transactions
        </p>
      </div>

      <PageHeader
        className="print:hidden"
        eyebrow={
          <>
            <span className="text-xs font-semibold tracking-wider uppercase">
              {currentYear} overview
            </span>
            {isDemoMode && <StatusBadge>Demo data</StatusBadge>}
          </>
        }
        title="Yearly Charts"
        description="See where the money went across the year: by month, category, person and place."
        actions={
          <>
            <YearSelector
              value={currentYear}
              onValueChange={setCurrentYear}
              range={10}
              triggerClassName="h-8 w-24"
            />
            <MonthFilter selectedMonths={selectedMonths} onSelectionChange={setSelectedMonths} />
            <CategoryFilter
              categories={allCategories}
              selectedCategories={effectiveCategories}
              onSelectionChange={setSelectedCategories}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5" disabled={!hasData}>
                  Export
                  <ChevronDown className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportPdf}>
                  <Printer className="size-4" />
                  PDF report
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void handleExportExcel(filteredYearExpenses, currentYear)}
                >
                  <FileSpreadsheet className="size-4" />
                  Excel (.xlsx)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {isFiltered && (
        <div className="bg-muted/50 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-2.5 text-sm print:hidden">
          <span>
            Showing{" "}
            <span className="text-foreground font-medium">
              {filteredYearExpenses.length.toLocaleString()}
            </span>{" "}
            of {expenses.length.toLocaleString()} expenses
            {selectedMonths.length > 0 &&
              ` · ${selectedMonths.length} ${selectedMonths.length === 1 ? "month" : "months"}`}
            {categoriesFiltered &&
              ` · ${selectedCategories.length} ${selectedCategories.length === 1 ? "category" : "categories"}`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-foreground ml-auto h-7 gap-1 px-2"
            onClick={clearFilters}
          >
            <X className="size-3.5" />
            Clear filters
          </Button>
        </div>
      )}

      {isLoading ? (
        <YearlyChartsPageSkeleton withHeader={false} />
      ) : !hasData ? (
        <EmptyState
          headingLevel="h2"
          icon={CalendarRange}
          title={`No expenses in ${currentYear}`}
          description="Pick another year, or add and import expenses to see charts for this one."
          actions={
            <>
              <Button asChild size="sm">
                <Link href="/expenses">Add expenses</Link>
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
          <section
            aria-label="Summary"
            className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 print:grid-cols-4"
          >
            <StatCard
              label="Total spent"
              icon={Wallet}
              value={formatCurrency(summary.total)}
              hint={`${currentYear}${isFiltered ? ", filtered" : ""}`}
            />
            <StatCard
              label="Monthly average"
              icon={CalendarRange}
              value={formatCurrency(summary.average)}
              hint={`Over ${summary.activeMonths} active ${summary.activeMonths === 1 ? "month" : "months"}`}
            />
            <StatCard
              label="Transactions"
              icon={Receipt}
              value={filteredYearExpenses.length.toLocaleString()}
              hint={`Average ${formatCurrency(
                filteredYearExpenses.length ? summary.total / filteredYearExpenses.length : 0,
              )} each`}
            />
            <StatCard
              label="Top category"
              icon={Layers}
              value={summary.topName ?? "—"}
              hint={
                summary.topName
                  ? `${formatCurrency(summary.topAmount)} · ${Math.round(
                      (summary.topAmount / Math.max(summary.total, 1)) * 100,
                    )}% of spending`
                  : "No spending for these filters"
              }
            />
          </section>

          {/* Charts */}
          <section aria-labelledby="charts-heading" className="space-y-3">
            <h2 id="charts-heading" className="sr-only">
              Charts
            </h2>
            <YearlyChartsGrid filteredExpenses={filteredYearExpenses} currentYear={currentYear} />
          </section>

          {/* Expenses table */}
          <section className="bg-card overflow-hidden rounded-2xl shadow-md print:hidden">
            <button
              type="button"
              aria-expanded={showTable}
              aria-controls="yearly-expenses-table"
              onClick={() => setShowTable((v) => !v)}
              className="hover:bg-muted/40 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors sm:px-6"
            >
              <span>
                <span className="block text-base font-semibold tracking-tight">
                  All expenses
                </span>
                <span className="text-muted-foreground block text-xs">
                  {filteredYearExpenses.length.toLocaleString()} rows matching the current filters
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground size-4 shrink-0 transition-transform",
                  showTable && "rotate-180",
                )}
              />
            </button>
            {showTable && (
              <div id="yearly-expenses-table" className="border-t px-4 pt-4 pb-5 sm:px-6">
                <DataTable
                  columns={columns}
                  data={filteredYearExpenses}
                  isReadOnly
                  embedded
                  renderMobileRow={(row) => <ExpenseMobileRow key={row.id} expense={row.original} />}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default YearlyChartsPage;
