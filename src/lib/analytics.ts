/**
 * src/lib/analytics.ts
 *
 * Feature 6: Advanced Analytics and Financial Reports — pure calculation layer.
 *
 * Every function here is deterministic and side-effect free: no React, no
 * Supabase, no browser APIs. That keeps the maths unit-testable
 * (tests/analytics.test.ts) and lets the page compute everything in a single
 * memoised pass (see buildAnalytics).
 *
 * Conventions
 *  - Dates are compared as local "YYYY-MM-DD" keys, never as UTC instants,
 *    so an expense on 31 December can never leak into January (or vice versa)
 *    because of a timezone offset.
 *  - Money is summed in integer pence and converted back to pounds once, so
 *    totals are exact (0.1 + 0.2 === 0.3) and chart totals always reconcile
 *    with the underlying expense records.
 *  - Months are 0-based (0 = January) to match Date#getMonth and the existing
 *    expenses page; budgets use 1-based months, as stored in the database.
 */

import type { AlertThreshold } from "@/entities/Alert";
import { computeThreshold, isOverBudget } from "@/lib/alertCalculation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Inclusive local-date range. Both ends are local midnight. */
export type DateRange = { start: Date; end: Date };

export type PeriodSelection =
  | { kind: "month"; year: number; month: number /* 0-11 */ }
  | { kind: "year"; year: number }
  | { kind: "custom"; start: string; end: string /* YYYY-MM-DD */ };

/** Minimal expense shape the analytics need (ExpenseWithDetails satisfies it). */
export type AnalyticsExpense = {
  id: string;
  amount: number;
  categoryId: string | null;
  date: Date | string;
};

/** Minimal budget shape (Budget satisfies it). `month` is 1-based. */
export type AnalyticsBudget = {
  year: number;
  month: number;
  categoryId: string;
  limitAmount: number;
};

/** Key used for expenses with no category. */
export const UNCATEGORIZED_KEY = "uncategorized";

/** Longest custom range accepted, to keep requests and charts bounded. */
export const MAX_CUSTOM_RANGE_MONTHS = 36;

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type MonthBucket = {
  /** "YYYY-MM" */
  key: string;
  year: number;
  month: number; // 0-11
  /** "Jan 2026" */
  label: string;
};

export type MonthlyPoint = MonthBucket & {
  total: number;
  count: number;
  /** Rolling average of `total` over the trend window (null until enough data). */
  trend: number | null;
  /** Change vs the previous month in the series, in pounds. */
  change: number | null;
  /** Percentage change vs the previous month (null when previous is 0). */
  changePct: number | null;
};

export type CategoryTotal = {
  key: string;
  name: string;
  total: number;
  count: number;
  /** Share of the period total, 0-100 (0 when the period total is not positive). */
  share: number;
  average: number;
};

/** Alert levels plus "under" (< 80 %) and "over" (critical and above the limit). */
export type BudgetStatus = "under" | AlertThreshold | "over";

export type BudgetPerformanceRow = {
  key: string;
  name: string;
  limit: number;
  spent: number;
  remaining: number;
  /** spent / limit × 100, not clamped (can exceed 100). */
  utilisation: number;
  status: BudgetStatus;
  /** Number of monthly budgets aggregated into this row. */
  months: number;
};

export type BudgetSummary = {
  rows: BudgetPerformanceRow[];
  totalLimit: number;
  totalSpent: number;
  /** null when there are no budgets in range. */
  utilisation: number | null;
  overBudgetCount: number;
};

export type MonthOverMonth = {
  current: MonthBucket & { total: number };
  previous: MonthBucket & { total: number };
  change: number;
  changePct: number | null;
};

export type AnalyticsOverview = {
  totalSpending: number;
  transactionCount: number;
  averageMonthlySpending: number;
  averageTransaction: number;
  /** Months used as the denominator for the monthly average. */
  monthsCounted: number;
  highestCategory: CategoryTotal | null;
  previousTotal: number;
  periodChangePct: number | null;
  monthOverMonth: MonthOverMonth | null;
  budgetUtilisation: number | null;
};

export type YearComparisonPoint = {
  month: string;
  current: number;
  previous: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Money helpers (integer pence)
// ─────────────────────────────────────────────────────────────────────────────

export const toPence = (amount: number): number =>
  Number.isFinite(amount) ? Math.round(amount * 100) : 0;

export const fromPence = (pence: number): number => pence / 100;

/** Exact sum of amounts, computed in pence. */
export const sumAmounts = (amounts: Iterable<number>): number => {
  let pence = 0;
  for (const a of amounts) pence += toPence(a);
  return fromPence(pence);
};

/**
 * Percentage change from `previous` to `current`.
 * Returns null when there is no meaningful baseline (previous is 0).
 */
export const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────────────────────────────────────

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar date → "YYYY-MM-DD". */
export const toDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** Local calendar month → "YYYY-MM". */
export const toMonthKey = (year: number, month0: number): string =>
  `${year}-${pad2(month0 + 1)}`;

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD" as a local date. Returns null for invalid input. */
export const parseDateKey = (value: string): Date | null => {
  const match = DATE_KEY_RE.exec(value.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  // Reject roll-overs such as 2026-02-30 → 2 March.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
};

/** Normalises an expense date (Date or "YYYY-MM-DD[T…]") to a local date key. */
export const expenseDateKey = (date: Date | string): string => {
  if (date instanceof Date) return toDateKey(date);
  return String(date).split("T")[0];
};

const lastDayOfMonth = (year: number, month0: number) =>
  new Date(year, month0 + 1, 0).getDate();

/**
 * Number of calendar days in the range (inclusive). Uses UTC day numbers so
 * daylight-saving changes (23- or 25-hour days) do not skew the count.
 */
export const rangeLengthInDays = (range: DateRange): number =>
  Math.round(
    (Date.UTC(range.end.getFullYear(), range.end.getMonth(), range.end.getDate()) -
      Date.UTC(range.start.getFullYear(), range.start.getMonth(), range.start.getDate())) /
      86_400_000,
  ) + 1;

/** Number of calendar months touched by the range (inclusive). */
export const countMonths = (range: DateRange): number =>
  (range.end.getFullYear() - range.start.getFullYear()) * 12 +
  (range.end.getMonth() - range.start.getMonth()) +
  1;

/**
 * Resolves a UI period selection to an inclusive date range.
 * Custom ranges are swapped when reversed. Invalid custom dates throw.
 */
export const resolvePeriod = (selection: PeriodSelection): DateRange => {
  switch (selection.kind) {
    case "month":
      return {
        end: new Date(selection.year, selection.month, lastDayOfMonth(selection.year, selection.month)),
        start: new Date(selection.year, selection.month, 1),
      };
    case "year":
      return {
        end: new Date(selection.year, 11, 31),
        start: new Date(selection.year, 0, 1),
      };
    case "custom": {
      const a = parseDateKey(selection.start);
      const b = parseDateKey(selection.end);
      if (!a || !b) throw new RangeError("Custom range dates must be valid YYYY-MM-DD values.");
      return a <= b ? { end: b, start: a } : { end: a, start: b };
    }
  }
};

/**
 * Validates a custom range for the UI. Returns an error message or null.
 */
export const validateCustomRange = (start: string, end: string): string | null => {
  const a = parseDateKey(start);
  const b = parseDateKey(end);
  if (!a || !b) return "Choose a valid start and end date.";
  if (a > b) return "The start date must be on or before the end date.";
  if (countMonths({ end: b, start: a }) > MAX_CUSTOM_RANGE_MONTHS) {
    return `Custom ranges are limited to ${MAX_CUSTOM_RANGE_MONTHS} months.`;
  }
  return null;
};

/**
 * The comparison period immediately before `selection`:
 *  - month  → the previous calendar month (December → previous year)
 *  - year   → the previous calendar year
 *  - custom → a window of the same number of days ending the day before
 */
export const previousPeriod = (selection: PeriodSelection): DateRange => {
  if (selection.kind === "month") {
    const prevMonth = selection.month === 0 ? 11 : selection.month - 1;
    const prevYear = selection.month === 0 ? selection.year - 1 : selection.year;
    return resolvePeriod({ kind: "month", month: prevMonth, year: prevYear });
  }
  if (selection.kind === "year") {
    return resolvePeriod({ kind: "year", year: selection.year - 1 });
  }
  const range = resolvePeriod(selection);
  const days = rangeLengthInDays(range);
  const end = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() - 1);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));
  return { end, start };
};

/** Every calendar month touched by the range, oldest first. */
export const enumerateMonths = (range: DateRange): MonthBucket[] => {
  const months: MonthBucket[] = [];
  let year = range.start.getFullYear();
  let month = range.start.getMonth();
  const endKey = toMonthKey(range.end.getFullYear(), range.end.getMonth());
  // Bounded loop: a range can never exceed a few hundred months in practice.
  for (let i = 0; i < 1200; i++) {
    const key = toMonthKey(year, month);
    months.push({ key, label: `${SHORT_MONTHS[month]} ${year}`, month, year });
    if (key === endKey) break;
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return months;
};

/** Distinct calendar years spanned by any of the ranges, ascending. */
export const yearsSpanned = (...ranges: DateRange[]): number[] => {
  const years = new Set<number>();
  for (const r of ranges) {
    for (let y = r.start.getFullYear(); y <= r.end.getFullYear(); y++) years.add(y);
  }
  return Array.from(years).sort((a, b) => a - b);
};

// ─────────────────────────────────────────────────────────────────────────────
// Filtering
// ─────────────────────────────────────────────────────────────────────────────

export const categoryKeyOf = (expense: Pick<AnalyticsExpense, "categoryId">): string =>
  expense.categoryId ?? UNCATEGORIZED_KEY;

/**
 * Expenses whose local date is inside the inclusive range and whose category
 * is in `categoryKeys` (an empty or missing list means all categories).
 */
export const filterExpenses = <T extends AnalyticsExpense>(
  expenses: readonly T[],
  range: DateRange | null,
  categoryKeys?: readonly string[],
): T[] => {
  const startKey = range ? toDateKey(range.start) : null;
  const endKey = range ? toDateKey(range.end) : null;
  const categories = categoryKeys && categoryKeys.length > 0 ? new Set(categoryKeys) : null;

  return expenses.filter((expense) => {
    if (categories && !categories.has(categoryKeyOf(expense))) return false;
    if (startKey && endKey) {
      const key = expenseDateKey(expense.date);
      if (key < startKey || key > endKey) return false;
    }
    return true;
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

/** Totals (in pence) and counts per "YYYY-MM", in one pass. */
const totalsByMonthKey = (expenses: readonly AnalyticsExpense[]) => {
  const totals = new Map<string, { pence: number; count: number }>();
  for (const e of expenses) {
    const key = expenseDateKey(e.date).slice(0, 7);
    const bucket = totals.get(key) ?? { count: 0, pence: 0 };
    bucket.pence += toPence(e.amount);
    bucket.count += 1;
    totals.set(key, bucket);
  }
  return totals;
};

/** Rolling mean of the last `window` values (null until `window` values exist). */
export const rollingAverage = (values: readonly number[], window = 3): (number | null)[] =>
  values.map((_, i) => {
    if (i + 1 < window) return null;
    const slice = values.slice(i + 1 - window, i + 1);
    return sumAmounts(slice) / window;
  });

/**
 * Monthly totals for every month of the range (empty months are 0), with a
 * rolling trend and month-over-month change.
 */
export const groupByMonth = (
  expenses: readonly AnalyticsExpense[],
  range: DateRange,
  trendWindow = 3,
): MonthlyPoint[] => {
  const totals = totalsByMonthKey(expenses);
  const buckets = enumerateMonths(range);
  const values = buckets.map((b) => fromPence(totals.get(b.key)?.pence ?? 0));
  const trend = rollingAverage(values, trendWindow);

  return buckets.map((bucket, i) => {
    const total = values[i];
    const previous = i > 0 ? values[i - 1] : null;
    return {
      ...bucket,
      change: previous === null ? null : fromPence(toPence(total) - toPence(previous)),
      changePct: previous === null ? null : percentChange(total, previous),
      count: totals.get(bucket.key)?.count ?? 0,
      total,
      trend: trend[i],
    };
  });
};

export type DailyPoint = {
  /** "YYYY-MM-DD" */
  key: string;
  /** "3 Jan" */
  label: string;
  total: number;
  /** Running total from the start of the range. */
  cumulative: number;
};

/** Longest range (in days) shown day by day in the trend chart. */
export const MAX_DAILY_POINTS = 62;

/**
 * Daily totals and running total for every day of the range (empty days are
 * 0). Used for short periods, where a monthly line would be a single point.
 */
export const groupByDay = (
  expenses: readonly AnalyticsExpense[],
  range: DateRange,
): DailyPoint[] => {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    const key = expenseDateKey(e.date);
    totals.set(key, (totals.get(key) ?? 0) + toPence(e.amount));
  }

  const points: DailyPoint[] = [];
  let running = 0;
  const cursor = new Date(range.start);
  for (let i = 0; i < 1100 && cursor <= range.end; i++) {
    const key = toDateKey(cursor);
    const pence = totals.get(key) ?? 0;
    running += pence;
    points.push({
      cumulative: fromPence(running),
      key,
      label: `${cursor.getDate()} ${SHORT_MONTHS[cursor.getMonth()]}`,
      total: fromPence(pence),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
};

/** Category totals sorted by spend (largest first). */
export const groupByCategory = (
  expenses: readonly AnalyticsExpense[],
  nameOf: (key: string) => string,
): CategoryTotal[] => {
  const totals = new Map<string, { pence: number; count: number }>();
  let grandPence = 0;
  for (const e of expenses) {
    const key = categoryKeyOf(e);
    const bucket = totals.get(key) ?? { count: 0, pence: 0 };
    const pence = toPence(e.amount);
    bucket.pence += pence;
    bucket.count += 1;
    grandPence += pence;
    totals.set(key, bucket);
  }

  return Array.from(totals.entries())
    .map(([key, { pence, count }]) => ({
      average: count > 0 ? fromPence(pence) / count : 0,
      count,
      key,
      name: nameOf(key),
      share: grandPence > 0 ? (pence / grandPence) * 100 : 0,
      total: fromPence(pence),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
};

/**
 * Budget status — reuses the Feature 5 alert thresholds (80% warning,
 * 100% critical) so analytics and alerts always agree. Analytics keeps its
 * extra "over" status for a critical budget whose spending exceeds the limit.
 */
export const budgetStatusFor = (spent: number, limit: number): BudgetStatus => {
  const level = computeThreshold(spent, limit);
  if (level === "critical" && isOverBudget({ limitAmount: limit, spentAmount: spent })) {
    return "over";
  }
  return level ?? "under";
};

/**
 * Budget-versus-actual per category for the months of `range`.
 *
 * Each monthly budget is compared with spending in that same category and
 * month only, so a category budgeted for one month is not charged with
 * spending from un-budgeted months in the range.
 */
export const budgetPerformance = (
  budgets: readonly AnalyticsBudget[],
  expenses: readonly AnalyticsExpense[],
  range: DateRange,
  nameOf: (key: string) => string,
  categoryKeys?: readonly string[],
): BudgetSummary => {
  const monthKeys = new Set(enumerateMonths(range).map((m) => m.key));
  const categories = categoryKeys && categoryKeys.length > 0 ? new Set(categoryKeys) : null;

  // Spend in pence per "YYYY-MM|category".
  const spendByMonthCategory = new Map<string, number>();
  for (const e of expenses) {
    const key = `${expenseDateKey(e.date).slice(0, 7)}|${categoryKeyOf(e)}`;
    spendByMonthCategory.set(key, (spendByMonthCategory.get(key) ?? 0) + toPence(e.amount));
  }

  const byCategory = new Map<string, { limit: number; spent: number; months: number }>();
  for (const b of budgets) {
    const monthKey = toMonthKey(b.year, b.month - 1);
    if (!monthKeys.has(monthKey)) continue;
    if (categories && !categories.has(b.categoryId)) continue;
    const row = byCategory.get(b.categoryId) ?? { limit: 0, months: 0, spent: 0 };
    row.limit += toPence(b.limitAmount);
    row.spent += spendByMonthCategory.get(`${monthKey}|${b.categoryId}`) ?? 0;
    row.months += 1;
    byCategory.set(b.categoryId, row);
  }

  let totalLimit = 0;
  let totalSpent = 0;
  const rows: BudgetPerformanceRow[] = Array.from(byCategory.entries())
    .map(([key, r]) => {
      totalLimit += r.limit;
      totalSpent += r.spent;
      const limit = fromPence(r.limit);
      const spent = fromPence(r.spent);
      return {
        key,
        limit,
        months: r.months,
        name: nameOf(key),
        remaining: fromPence(r.limit - r.spent),
        spent,
        status: budgetStatusFor(spent, limit),
        utilisation: limit > 0 ? (spent / limit) * 100 : 0,
      };
    })
    .sort((a, b) => b.utilisation - a.utilisation || a.name.localeCompare(b.name));

  return {
    overBudgetCount: rows.filter((r) => r.status === "over").length,
    rows,
    totalLimit: fromPence(totalLimit),
    totalSpent: fromPence(totalSpent),
    utilisation: totalLimit > 0 ? (totalSpent / totalLimit) * 100 : null,
  };
};

/** Monthly totals for `year` and the year before, month by month. */
export const yearComparison = (
  expenses: readonly AnalyticsExpense[],
  year: number,
): YearComparisonPoint[] => {
  const totals = totalsByMonthKey(expenses);
  return SHORT_MONTHS.map((month, i) => ({
    current: fromPence(totals.get(toMonthKey(year, i))?.pence ?? 0),
    month,
    previous: fromPence(totals.get(toMonthKey(year - 1, i))?.pence ?? 0),
  }));
};

/**
 * Month-over-month change for the latest month of the range that has started
 * (relative to `today`), compared with the calendar month before it.
 * `expenses` must include the previous month (it is filtered by category only).
 */
export const monthOverMonth = (
  expenses: readonly AnalyticsExpense[],
  range: DateRange,
  today: Date,
): MonthOverMonth | null => {
  const todayKey = toMonthKey(today.getFullYear(), today.getMonth());
  const months = enumerateMonths(range).filter((m) => m.key <= todayKey);
  const current = months[months.length - 1];
  if (!current) return null;

  const prevMonth = current.month === 0 ? 11 : current.month - 1;
  const prevYear = current.month === 0 ? current.year - 1 : current.year;
  const previous: MonthBucket = {
    key: toMonthKey(prevYear, prevMonth),
    label: `${SHORT_MONTHS[prevMonth]} ${prevYear}`,
    month: prevMonth,
    year: prevYear,
  };

  const totals = totalsByMonthKey(expenses);
  const currentTotal = fromPence(totals.get(current.key)?.pence ?? 0);
  const previousTotal = fromPence(totals.get(previous.key)?.pence ?? 0);

  return {
    change: fromPence(toPence(currentTotal) - toPence(previousTotal)),
    changePct: percentChange(currentTotal, previousTotal),
    current: { ...current, total: currentTotal },
    previous: { ...previous, total: previousTotal },
  };
};

/**
 * Number of months used for the "average monthly spending" denominator:
 * months of the range that have started by `today` (minimum 1). Future months
 * are excluded so a year-to-date average is not diluted by empty months.
 */
export const monthsElapsed = (range: DateRange, today: Date): number => {
  const todayKey = toMonthKey(today.getFullYear(), today.getMonth());
  const elapsed = enumerateMonths(range).filter((m) => m.key <= todayKey).length;
  return Math.max(1, elapsed);
};

// ─────────────────────────────────────────────────────────────────────────────
// Single-pass entry point used by the page
// ─────────────────────────────────────────────────────────────────────────────

export type BuildAnalyticsInput = {
  /** All loaded expenses (any years). Filtering happens here. */
  expenses: readonly AnalyticsExpense[];
  /** Budgets for the loaded years, or null when budgets are unavailable. */
  budgets: readonly AnalyticsBudget[] | null;
  selection: PeriodSelection;
  /** Category keys to include; empty = all. */
  categoryKeys: readonly string[];
  nameOf: (key: string) => string;
  today: Date;
};

export type AnalyticsResult = {
  range: DateRange;
  previousRange: DateRange;
  /** Expenses in range and category filter — the source for every figure. */
  periodExpenses: AnalyticsExpense[];
  overview: AnalyticsOverview;
  monthly: MonthlyPoint[];
  /** Day-by-day series, only for ranges of at most MAX_DAILY_POINTS days. */
  daily: DailyPoint[] | null;
  categories: CategoryTotal[];
  budgets: BudgetSummary | null;
  comparisonYear: number;
  yearComparison: YearComparisonPoint[];
};

export const buildAnalytics = ({
  budgets,
  categoryKeys,
  expenses,
  nameOf,
  selection,
  today,
}: BuildAnalyticsInput): AnalyticsResult => {
  const range = resolvePeriod(selection);
  const prevRange = previousPeriod(selection);

  // Category filter applied once; date windows are cheap string compares.
  const categoryFiltered = filterExpenses(expenses, null, categoryKeys);
  const periodExpenses = filterExpenses(categoryFiltered, range);
  const previousExpenses = filterExpenses(categoryFiltered, prevRange);

  const monthly = groupByMonth(periodExpenses, range);
  const daily = rangeLengthInDays(range) <= MAX_DAILY_POINTS ? groupByDay(periodExpenses, range) : null;
  const categories = groupByCategory(periodExpenses, nameOf);
  const budgetSummary = budgets
    ? budgetPerformance(budgets, periodExpenses, range, nameOf, categoryKeys)
    : null;

  const totalSpending = sumAmounts(periodExpenses.map((e) => e.amount));
  const previousTotal = sumAmounts(previousExpenses.map((e) => e.amount));
  const monthsCounted = monthsElapsed(range, today);
  const comparisonYear = range.end.getFullYear();

  return {
    budgets: budgetSummary,
    categories,
    comparisonYear,
    daily,
    monthly,
    overview: {
      averageMonthlySpending: totalSpending / monthsCounted,
      averageTransaction: periodExpenses.length > 0 ? totalSpending / periodExpenses.length : 0,
      budgetUtilisation: budgetSummary?.utilisation ?? null,
      highestCategory: categories.find((c) => c.total > 0) ?? null,
      monthOverMonth: monthOverMonth(categoryFiltered, range, today),
      monthsCounted,
      periodChangePct: percentChange(totalSpending, previousTotal),
      previousTotal,
      totalSpending,
      transactionCount: periodExpenses.length,
    },
    periodExpenses,
    previousRange: prevRange,
    range,
    yearComparison: yearComparison(categoryFiltered, comparisonYear),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes one CSV cell (RFC 4180) and neutralises spreadsheet formula
 * injection: text beginning with = + - @ tab or CR is prefixed with a quote
 * so Excel/Sheets treat it as text. Numbers are written as-is.
 */
export const escapeCsvCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const toCsv = (
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string =>
  [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");

/** Pounds to a fixed 2-dp number for CSV (no currency symbol, sortable in Excel). */
const csvMoney = (amount: number) => Number(amount.toFixed(2));
const csvPct = (pct: number | null) => (pct === null ? "" : Number(pct.toFixed(1)));

export const monthlySummaryCsv = (monthly: readonly MonthlyPoint[]): string =>
  toCsv(
    ["Month", "Total (GBP)", "Transactions", "Average transaction (GBP)", "Change vs previous month (GBP)", "Change vs previous month (%)"],
    monthly.map((m) => [
      m.label,
      csvMoney(m.total),
      m.count,
      csvMoney(m.count > 0 ? m.total / m.count : 0),
      m.change === null ? "" : csvMoney(m.change),
      csvPct(m.changePct),
    ]),
  );

export const categoryBreakdownCsv = (categories: readonly CategoryTotal[]): string =>
  toCsv(
    ["Category", "Total (GBP)", "Share of spending (%)", "Transactions", "Average transaction (GBP)"],
    categories.map((c) => [c.name, csvMoney(c.total), csvPct(c.share), c.count, csvMoney(c.average)]),
  );

export const budgetPerformanceCsv = (rows: readonly BudgetPerformanceRow[]): string =>
  toCsv(
    ["Category", "Budget (GBP)", "Spent (GBP)", "Remaining (GBP)", "Utilisation (%)", "Status", "Budgeted months"],
    rows.map((r) => [
      r.name,
      csvMoney(r.limit),
      csvMoney(r.spent),
      csvMoney(r.remaining),
      csvPct(r.utilisation),
      r.status,
      r.months,
    ]),
  );

/** Human-readable label for a date range, e.g. "1 Jan 2026 – 31 Mar 2026". */
export const formatRangeLabel = (range: DateRange): string => {
  const fmt = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return `${fmt(range.start)} – ${fmt(range.end)}`;
};

/** One CSV containing the overview and all three reports, separated by blank lines. */
export const fullReportCsv = (result: AnalyticsResult, generatedAt: Date): string => {
  const o = result.overview;
  const overview = toCsv(
    ["Metric", "Value"],
    [
      ["Period", formatRangeLabel(result.range)],
      ["Generated", generatedAt.toISOString()],
      ["Total spending (GBP)", csvMoney(o.totalSpending)],
      ["Transactions", o.transactionCount],
      ["Average monthly spending (GBP)", csvMoney(o.averageMonthlySpending)],
      ["Highest spending category", o.highestCategory?.name ?? ""],
      ["Budget utilisation (%)", csvPct(o.budgetUtilisation)],
      ["Change vs previous period (%)", csvPct(o.periodChangePct)],
    ],
  );
  const sections = [
    "Overview",
    overview,
    "",
    "Monthly expense summary",
    monthlySummaryCsv(result.monthly),
    "",
    "Category spending breakdown",
    categoryBreakdownCsv(result.categories),
  ];
  if (result.budgets) {
    sections.push("", "Budget performance summary", budgetPerformanceCsv(result.budgets.rows));
  }
  return sections.join("\r\n");
};
