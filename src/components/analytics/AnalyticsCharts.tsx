"use client";

/**
 * Chart grid for the analytics page. Loaded with next/dynamic so Recharts is
 * only downloaded when the page renders charts (same approach as the Yearly
 * Charts page).
 */

import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import type { AnalyticsResult } from "@/lib/analytics";

import BudgetVsActualChart from "./BudgetVsActualChart";
import CategoryDonutChart from "./CategoryDonutChart";
import SpendingTrendChart from "./SpendingTrendChart";
import YearComparisonChart from "./YearComparisonChart";

type AnalyticsChartsProps = {
  data: AnalyticsResult;
  budgetsStatus: BudgetsForYearsStatus;
};

const AnalyticsCharts = ({ budgetsStatus, data }: AnalyticsChartsProps) => (
  <section aria-label="Spending charts" className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-3">
      <SpendingTrendChart
        monthly={data.monthly}
        daily={data.daily}
        hasData={data.periodExpenses.length > 0}
      />
      <CategoryDonutChart categories={data.categories} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <BudgetVsActualChart summary={data.budgets} status={budgetsStatus} />
      <YearComparisonChart data={data.yearComparison} year={data.comparisonYear} />
    </div>
  </section>
);

export default AnalyticsCharts;
