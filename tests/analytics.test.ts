/**
 * tests/analytics.test.ts
 *
 * Unit tests for Feature 6: Advanced Analytics and Financial Reports
 * (src/lib/analytics.ts).
 *
 * Tests cover:
 *  1. Money helpers — pence arithmetic, percentChange
 *  2. Date helpers — parseDateKey, resolvePeriod, previousPeriod, leap years
 *  3. Month enumeration and year boundaries
 *  4. filterExpenses — inclusive boundaries, category filter, uncategorised
 *  5. groupByMonth — totals reconcile with records, MoM change, trend
 *  6. groupByCategory — totals reconcile, shares, ordering
 *  7. budgetPerformance — per-month matching, statuses, utilisation
 *  8. monthOverMonth / monthsElapsed — year boundary, future months
 *  9. yearComparison
 * 10. buildAnalytics — end-to-end reconciliation, empty datasets
 * 11. CSV export — escaping and formula-injection protection
 *
 * Run: node_modules/.bin/tsx --test tests/analytics.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type AnalyticsBudget,
  type AnalyticsExpense,
  budgetPerformance,
  budgetStatusFor,
  buildAnalytics,
  categoryBreakdownCsv,
  countMonths,
  enumerateMonths,
  escapeCsvCell,
  filterExpenses,
  formatRangeLabel,
  fullReportCsv,
  groupByCategory,
  groupByDay,
  groupByMonth,
  monthOverMonth,
  monthsElapsed,
  parseDateKey,
  percentChange,
  previousPeriod,
  rangeLengthInDays,
  resolvePeriod,
  rollingAverage,
  sumAmounts,
  toCsv,
  toDateKey,
  UNCATEGORIZED_KEY,
  validateCustomRange,
  yearComparison,
  yearsSpanned,
} from "../src/lib/analytics.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

let seq = 0;
const exp = (
  date: string,
  amount: number,
  categoryId: string | null = "1",
): AnalyticsExpense => ({ amount, categoryId, date, id: `e${++seq}` });

const NAMES: Record<string, string> = {
  "1": "Grocery",
  "2": "Takeout",
  "3": "Misc",
  [UNCATEGORIZED_KEY]: "Uncategorized",
};
const nameOf = (key: string) => NAMES[key] ?? key;

const budget = (year: number, month: number, categoryId: string, limitAmount: number): AnalyticsBudget => ({
  categoryId,
  limitAmount,
  month,
  year,
});

const range = (start: string, end: string) => ({
  end: parseDateKey(end)!,
  start: parseDateKey(start)!,
});

/** Sum of raw record amounts in pence — the independent reference total. */
const referenceTotal = (records: AnalyticsExpense[]) =>
  records.reduce((p, e) => p + Math.round(e.amount * 100), 0) / 100;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Money helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("money helpers", () => {
  it("sums exactly in pence (no floating-point drift)", () => {
    assert.equal(sumAmounts([0.1, 0.2]), 0.3);
    assert.equal(sumAmounts(Array(10).fill(0.1)), 1);
  });

  it("sums refunds (negative amounts)", () => {
    assert.equal(sumAmounts([25.5, -5.25]), 20.25);
  });

  it("ignores non-finite amounts", () => {
    assert.equal(sumAmounts([10, Number.NaN, Number.POSITIVE_INFINITY]), 10);
  });

  it("returns 0 for an empty list", () => {
    assert.equal(sumAmounts([]), 0);
  });

  it("percentChange returns null when there is no baseline", () => {
    assert.equal(percentChange(50, 0), null);
    assert.equal(percentChange(0, 0), null);
  });

  it("percentChange handles increases and decreases", () => {
    assert.equal(percentChange(150, 100), 50);
    assert.equal(percentChange(75, 100), -25);
    assert.equal(percentChange(0, 100), -100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Date helpers
// ─────────────────────────────────────────────────────────────────────────────

describe("parseDateKey", () => {
  it("parses a valid local date", () => {
    const d = parseDateKey("2026-03-15")!;
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 2);
    assert.equal(d.getDate(), 15);
  });

  it("rejects malformed and rolled-over dates", () => {
    assert.equal(parseDateKey("2026-3-15"), null);
    assert.equal(parseDateKey("2026-02-30"), null);
    assert.equal(parseDateKey("2025-02-29"), null);
    assert.equal(parseDateKey(""), null);
    assert.equal(parseDateKey("not-a-date"), null);
  });

  it("accepts 29 February in a leap year", () => {
    assert.notEqual(parseDateKey("2024-02-29"), null);
  });

  it("round-trips through toDateKey", () => {
    assert.equal(toDateKey(parseDateKey("2026-12-31")!), "2026-12-31");
  });
});

describe("resolvePeriod", () => {
  it("month covers the first to the last day", () => {
    const r = resolvePeriod({ kind: "month", month: 0, year: 2026 });
    assert.equal(toDateKey(r.start), "2026-01-01");
    assert.equal(toDateKey(r.end), "2026-01-31");
  });

  it("February ends on the 29th in a leap year and the 28th otherwise", () => {
    assert.equal(toDateKey(resolvePeriod({ kind: "month", month: 1, year: 2024 }).end), "2024-02-29");
    assert.equal(toDateKey(resolvePeriod({ kind: "month", month: 1, year: 2026 }).end), "2026-02-28");
  });

  it("year covers 1 January to 31 December", () => {
    const r = resolvePeriod({ kind: "year", year: 2025 });
    assert.equal(toDateKey(r.start), "2025-01-01");
    assert.equal(toDateKey(r.end), "2025-12-31");
  });

  it("custom range is swapped when reversed", () => {
    const r = resolvePeriod({ end: "2026-01-10", kind: "custom", start: "2026-03-05" });
    assert.equal(toDateKey(r.start), "2026-01-10");
    assert.equal(toDateKey(r.end), "2026-03-05");
  });

  it("custom range with invalid dates throws", () => {
    assert.throws(() => resolvePeriod({ end: "2026-01-10", kind: "custom", start: "bad" }), RangeError);
  });
});

describe("validateCustomRange", () => {
  it("accepts a valid range", () => {
    assert.equal(validateCustomRange("2026-01-01", "2026-06-30"), null);
  });

  it("accepts a single day", () => {
    assert.equal(validateCustomRange("2026-01-01", "2026-01-01"), null);
  });

  it("rejects invalid dates", () => {
    assert.match(validateCustomRange("", "2026-01-01")!, /valid/);
  });

  it("rejects a start after the end", () => {
    assert.match(validateCustomRange("2026-02-01", "2026-01-01")!, /before/);
  });

  it("rejects ranges longer than 36 months", () => {
    assert.equal(validateCustomRange("2023-01-01", "2025-12-31"), null); // exactly 36
    assert.match(validateCustomRange("2023-01-01", "2026-01-01")!, /36 months/);
  });
});

describe("previousPeriod", () => {
  it("January's previous period is December of the previous year", () => {
    const p = previousPeriod({ kind: "month", month: 0, year: 2026 });
    assert.equal(toDateKey(p.start), "2025-12-01");
    assert.equal(toDateKey(p.end), "2025-12-31");
  });

  it("a mid-year month's previous period is the month before", () => {
    const p = previousPeriod({ kind: "month", month: 2, year: 2024 });
    assert.equal(toDateKey(p.start), "2024-02-01");
    assert.equal(toDateKey(p.end), "2024-02-29");
  });

  it("year's previous period is the previous calendar year", () => {
    const p = previousPeriod({ kind: "year", year: 2026 });
    assert.equal(toDateKey(p.start), "2025-01-01");
    assert.equal(toDateKey(p.end), "2025-12-31");
  });

  it("custom range's previous period has the same length and ends the day before", () => {
    // 10 days: 1–10 Jan 2026 → 22–31 Dec 2025
    const p = previousPeriod({ end: "2026-01-10", kind: "custom", start: "2026-01-01" });
    assert.equal(toDateKey(p.start), "2025-12-22");
    assert.equal(toDateKey(p.end), "2025-12-31");
  });

  it("custom range across a DST change still has the same day count", () => {
    // 29 Mar 2026 is the UK clocks-forward date.
    const p = previousPeriod({ end: "2026-04-04", kind: "custom", start: "2026-03-28" });
    assert.equal(toDateKey(p.start), "2026-03-20");
    assert.equal(toDateKey(p.end), "2026-03-27");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Month enumeration / year boundaries
// ─────────────────────────────────────────────────────────────────────────────

describe("enumerateMonths / countMonths / yearsSpanned", () => {
  it("lists months across a year boundary in order", () => {
    const months = enumerateMonths(range("2025-11-15", "2026-02-03"));
    assert.deepEqual(months.map((m) => m.key), ["2025-11", "2025-12", "2026-01", "2026-02"]);
    assert.equal(months[2].label, "Jan 2026");
  });

  it("a single-day range has one month", () => {
    assert.equal(enumerateMonths(range("2026-05-05", "2026-05-05")).length, 1);
    assert.equal(countMonths(range("2026-05-05", "2026-05-05")), 1);
  });

  it("a full year has 12 months", () => {
    assert.equal(enumerateMonths(resolvePeriod({ kind: "year", year: 2026 })).length, 12);
  });

  it("yearsSpanned merges ranges and de-duplicates", () => {
    assert.deepEqual(
      yearsSpanned(range("2025-12-01", "2026-01-31"), range("2024-06-01", "2025-01-01")),
      [2024, 2025, 2026],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. filterExpenses
// ─────────────────────────────────────────────────────────────────────────────

describe("filterExpenses", () => {
  const records = [
    exp("2025-12-31", 10),
    exp("2026-01-01", 20),
    exp("2026-01-31", 30),
    exp("2026-02-01", 40),
    exp("2026-01-15", 5, "2"),
    exp("2026-01-16", 7, null),
  ];

  it("includes both inclusive boundary days and excludes neighbours", () => {
    const jan = filterExpenses(records, range("2026-01-01", "2026-01-31"));
    assert.deepEqual(jan.map((e) => e.amount).sort((a, b) => a - b), [5, 7, 20, 30]);
  });

  it("does not leak 31 December into January (year boundary)", () => {
    const jan = filterExpenses(records, resolvePeriod({ kind: "month", month: 0, year: 2026 }));
    assert.ok(!jan.some((e) => e.date === "2025-12-31"));
  });

  it("handles Date objects as well as strings", () => {
    const withDates = [{ ...exp("x", 1), date: new Date(2026, 0, 31) }];
    assert.equal(filterExpenses(withDates, range("2026-01-01", "2026-01-31")).length, 1);
  });

  it("handles ISO timestamps by their calendar date", () => {
    const iso = [exp("2026-01-31T23:30:00.000Z", 1)];
    assert.equal(filterExpenses(iso, range("2026-01-01", "2026-01-31")).length, 1);
  });

  it("filters by category", () => {
    const takeout = filterExpenses(records, null, ["2"]);
    assert.deepEqual(takeout.map((e) => e.amount), [5]);
  });

  it("filters uncategorised expenses by the uncategorised key", () => {
    const none = filterExpenses(records, null, [UNCATEGORIZED_KEY]);
    assert.deepEqual(none.map((e) => e.amount), [7]);
  });

  it("an empty category list means all categories", () => {
    assert.equal(filterExpenses(records, null, []).length, records.length);
  });

  it("returns an empty array for an empty dataset", () => {
    assert.deepEqual(filterExpenses([], range("2026-01-01", "2026-12-31")), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. groupByMonth
// ─────────────────────────────────────────────────────────────────────────────

describe("groupByMonth", () => {
  const r = range("2026-01-01", "2026-04-30");
  const records = [
    exp("2026-01-05", 100.1),
    exp("2026-01-20", 0.2),
    exp("2026-02-10", 50),
    exp("2026-04-30", 200),
  ];

  it("monthly totals reconcile with the expense records", () => {
    const points = groupByMonth(records, r);
    assert.equal(sumAmounts(points.map((p) => p.total)), referenceTotal(records));
    assert.equal(points.reduce((n, p) => n + p.count, 0), records.length);
  });

  it("fills empty months with zero", () => {
    const points = groupByMonth(records, r);
    assert.deepEqual(points.map((p) => p.total), [100.3, 50, 0, 200]);
  });

  it("computes month-over-month change", () => {
    const points = groupByMonth(records, r);
    assert.equal(points[0].change, null);
    assert.equal(points[1].change, -50.3);
    assert.equal(points[3].change, 200);
    assert.equal(points[3].changePct, null); // previous month was 0
  });

  it("computes a 3-month rolling trend", () => {
    const points = groupByMonth(records, r);
    assert.equal(points[0].trend, null);
    assert.equal(points[1].trend, null);
    assert.ok(Math.abs(points[2].trend! - 150.3 / 3) < 1e-9);
  });

  it("returns zero-filled months for an empty dataset", () => {
    const points = groupByMonth([], r);
    assert.equal(points.length, 4);
    assert.ok(points.every((p) => p.total === 0 && p.count === 0));
  });

  it("rollingAverage with a window of 1 returns the values", () => {
    assert.deepEqual(rollingAverage([1, 2, 3], 1), [1, 2, 3]);
  });
});

describe("groupByDay / rangeLengthInDays", () => {
  it("counts days inclusively, including leap days and DST changes", () => {
    assert.equal(rangeLengthInDays(range("2026-01-01", "2026-01-01")), 1);
    assert.equal(rangeLengthInDays(range("2024-02-01", "2024-02-29")), 29);
    assert.equal(rangeLengthInDays(range("2026-03-01", "2026-03-31")), 31); // UK DST on 29 Mar
    assert.equal(rangeLengthInDays(range("2025-12-30", "2026-01-02")), 4);
  });

  it("returns one point per day with empty days at zero", () => {
    const points = groupByDay([exp("2026-02-02", 5), exp("2026-02-02", 2.5)], range("2026-02-01", "2026-02-03"));
    assert.deepEqual(points.map((p) => p.total), [0, 7.5, 0]);
    assert.equal(points[1].label, "2 Feb");
  });

  it("running total ends at the period total (reconciles with records)", () => {
    const records = [exp("2025-12-31", 10.1), exp("2026-01-01", 0.2), exp("2026-01-02", 30)];
    const points = groupByDay(records, range("2025-12-31", "2026-01-02"));
    assert.equal(points[points.length - 1].cumulative, referenceTotal(records));
    assert.deepEqual(points.map((p) => p.key), ["2025-12-31", "2026-01-01", "2026-01-02"]);
  });

  it("buildAnalytics provides a daily series for a month and not for a year", () => {
    const base = { budgets: null, categoryKeys: [], expenses: [], nameOf, today: new Date(2026, 5, 1) };
    assert.equal(buildAnalytics({ ...base, selection: { kind: "month", month: 1, year: 2024 } }).daily?.length, 29);
    assert.equal(buildAnalytics({ ...base, selection: { kind: "year", year: 2026 } }).daily, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. groupByCategory
// ─────────────────────────────────────────────────────────────────────────────

describe("groupByCategory", () => {
  const records = [
    exp("2026-01-01", 30, "1"),
    exp("2026-01-02", 10, "1"),
    exp("2026-01-03", 60, "2"),
    exp("2026-01-04", 0, null),
  ];

  it("category totals reconcile with the expense records", () => {
    const cats = groupByCategory(records, nameOf);
    assert.equal(sumAmounts(cats.map((c) => c.total)), referenceTotal(records));
  });

  it("sorts by total, largest first, and resolves names", () => {
    const cats = groupByCategory(records, nameOf);
    assert.deepEqual(cats.map((c) => c.name), ["Takeout", "Grocery", "Uncategorized"]);
  });

  it("shares add up to 100%", () => {
    const cats = groupByCategory(records, nameOf);
    const share = cats.reduce((s, c) => s + c.share, 0);
    assert.ok(Math.abs(share - 100) < 1e-9);
    assert.equal(cats[0].share, 60);
  });

  it("computes count and average per category", () => {
    const grocery = groupByCategory(records, nameOf).find((c) => c.key === "1")!;
    assert.equal(grocery.count, 2);
    assert.equal(grocery.average, 20);
  });

  it("returns no categories for an empty dataset", () => {
    assert.deepEqual(groupByCategory([], nameOf), []);
  });

  it("shares are 0 (not NaN) when the total is not positive", () => {
    const cats = groupByCategory([exp("2026-01-01", 10), exp("2026-01-02", -10)], nameOf);
    assert.ok(cats.every((c) => c.share === 0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. budgetPerformance
// ─────────────────────────────────────────────────────────────────────────────

describe("budgetStatusFor", () => {
  it("matches the Feature 5 alert thresholds", () => {
    assert.equal(budgetStatusFor(79.99, 100), "under");
    assert.equal(budgetStatusFor(80, 100), "warning");
    assert.equal(budgetStatusFor(100, 100), "critical");
    assert.equal(budgetStatusFor(100.01, 100), "over");
    assert.equal(budgetStatusFor(50, 0), "under");
  });
});

describe("budgetPerformance", () => {
  const records = [
    exp("2026-01-10", 90, "1"), // Jan grocery
    exp("2026-02-10", 500, "1"), // Feb grocery — no Feb grocery budget
    exp("2026-01-12", 120, "2"), // Jan takeout
    exp("2026-02-12", 40, "2"), // Feb takeout
  ];
  const budgets = [
    budget(2026, 1, "1", 100),
    budget(2026, 1, "2", 100),
    budget(2026, 2, "2", 100),
    budget(2025, 12, "1", 999), // outside range
  ];
  const r = range("2026-01-01", "2026-02-28");

  it("only charges spending from budgeted months", () => {
    const s = budgetPerformance(budgets, records, r, nameOf);
    const grocery = s.rows.find((x) => x.key === "1")!;
    assert.equal(grocery.limit, 100);
    assert.equal(grocery.spent, 90); // Feb's £500 is not budgeted
    assert.equal(grocery.status, "warning");
  });

  it("aggregates several monthly budgets for one category", () => {
    const takeout = budgetPerformance(budgets, records, r, nameOf).rows.find((x) => x.key === "2")!;
    assert.equal(takeout.limit, 200);
    assert.equal(takeout.spent, 160);
    assert.equal(takeout.months, 2);
    assert.equal(takeout.remaining, 40);
    assert.equal(takeout.utilisation, 80);
  });

  it("ignores budgets outside the range", () => {
    const s = budgetPerformance(budgets, records, r, nameOf);
    assert.equal(s.totalLimit, 300);
  });

  it("computes overall utilisation and over-budget count", () => {
    const s = budgetPerformance(budgets, [...records, exp("2026-01-20", 50, "2")], r, nameOf);
    assert.equal(s.totalSpent, 300);
    assert.equal(s.utilisation, 100);
    assert.equal(s.overBudgetCount, 1); // Jan takeout: 170 of 100 → aggregated 210/200
  });

  it("respects the category filter", () => {
    const s = budgetPerformance(budgets, records, r, nameOf, ["1"]);
    assert.deepEqual(s.rows.map((x) => x.key), ["1"]);
  });

  it("returns null utilisation when there are no budgets", () => {
    const s = budgetPerformance([], records, r, nameOf);
    assert.equal(s.utilisation, null);
    assert.equal(s.rows.length, 0);
    assert.equal(s.totalLimit, 0);
  });

  it("reports negative remaining when over budget", () => {
    const s = budgetPerformance([budget(2026, 1, "2", 100)], records, r, nameOf);
    assert.equal(s.rows[0].remaining, -20);
    assert.equal(s.rows[0].status, "over");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. monthOverMonth / monthsElapsed
// ─────────────────────────────────────────────────────────────────────────────

describe("monthOverMonth", () => {
  const records = [exp("2025-12-15", 200), exp("2026-01-15", 150), exp("2026-03-01", 999)];

  it("compares January with the previous December (year boundary)", () => {
    const m = monthOverMonth(records, resolvePeriod({ kind: "month", month: 0, year: 2026 }), new Date(2026, 5, 1))!;
    assert.equal(m.current.key, "2026-01");
    assert.equal(m.previous.key, "2025-12");
    assert.equal(m.change, -50);
    assert.equal(m.changePct, -25);
  });

  it("uses the latest started month, not future months", () => {
    const m = monthOverMonth(records, resolvePeriod({ kind: "year", year: 2026 }), new Date(2026, 1, 10))!;
    assert.equal(m.current.key, "2026-02");
    assert.equal(m.current.total, 0);
    assert.equal(m.previous.total, 150);
  });

  it("returns null when the whole range is in the future", () => {
    assert.equal(
      monthOverMonth(records, resolvePeriod({ kind: "year", year: 2030 }), new Date(2026, 0, 1)),
      null,
    );
  });

  it("changePct is null when the previous month had no spending", () => {
    const m = monthOverMonth([exp("2026-01-15", 10)], resolvePeriod({ kind: "month", month: 0, year: 2026 }), new Date(2026, 0, 20))!;
    assert.equal(m.changePct, null);
    assert.equal(m.change, 10);
  });
});

describe("monthsElapsed", () => {
  it("counts only months that have started", () => {
    assert.equal(monthsElapsed(resolvePeriod({ kind: "year", year: 2026 }), new Date(2026, 2, 15)), 3);
  });

  it("counts every month of a past year", () => {
    assert.equal(monthsElapsed(resolvePeriod({ kind: "year", year: 2025 }), new Date(2026, 2, 15)), 12);
  });

  it("never returns less than 1", () => {
    assert.equal(monthsElapsed(resolvePeriod({ kind: "year", year: 2030 }), new Date(2026, 0, 1)), 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. yearComparison
// ─────────────────────────────────────────────────────────────────────────────

describe("yearComparison", () => {
  it("lines up the same month of consecutive years", () => {
    const rows = yearComparison(
      [exp("2026-01-05", 10), exp("2025-01-31", 7), exp("2025-12-31", 3), exp("2024-01-01", 99)],
      2026,
    );
    assert.equal(rows.length, 12);
    assert.deepEqual(rows[0], { current: 10, month: "Jan", previous: 7 });
    assert.deepEqual(rows[11], { current: 0, month: "Dec", previous: 3 });
  });

  it("returns zeros for an empty dataset", () => {
    assert.ok(yearComparison([], 2026).every((r) => r.current === 0 && r.previous === 0));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. buildAnalytics — end-to-end
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAnalytics", () => {
  const records = [
    exp("2025-12-20", 40, "1"),
    exp("2026-01-03", 12.34, "1"),
    exp("2026-01-15", 56.78, "2"),
    exp("2026-01-31", 10.1, null),
    exp("2026-02-01", 300, "2"),
  ];
  const today = new Date(2026, 5, 1);

  it("every chart and total reconciles with the filtered records", () => {
    const result = buildAnalytics({
      budgets: [],
      categoryKeys: [],
      expenses: records,
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today,
    });
    const jan = records.filter((e) => String(e.date).startsWith("2026-01"));
    const expected = referenceTotal(jan); // 79.22

    assert.equal(result.overview.totalSpending, expected);
    assert.equal(result.overview.transactionCount, jan.length);
    assert.equal(sumAmounts(result.monthly.map((m) => m.total)), expected);
    assert.equal(sumAmounts(result.categories.map((c) => c.total)), expected);
    assert.equal(result.periodExpenses.length, jan.length);
    assert.equal(result.yearComparison[0].current, expected);
  });

  it("computes the overview metrics", () => {
    const { overview } = buildAnalytics({
      budgets: [budget(2026, 1, "2", 100)],
      categoryKeys: [],
      expenses: records,
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today,
    });
    assert.equal(overview.highestCategory?.name, "Takeout");
    assert.equal(overview.previousTotal, 40);
    assert.ok(Math.abs(overview.periodChangePct! - ((79.22 - 40) / 40) * 100) < 1e-9);
    assert.equal(overview.monthsCounted, 1);
    assert.equal(overview.averageMonthlySpending, 79.22);
    assert.ok(Math.abs(overview.budgetUtilisation! - 56.78) < 1e-9);
    assert.equal(overview.monthOverMonth?.previous.key, "2025-12");
  });

  it("applies the category filter to every output consistently", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: ["2"],
      expenses: records,
      nameOf,
      selection: { kind: "year", year: 2026 },
      today,
    });
    assert.equal(result.overview.totalSpending, 356.78);
    assert.equal(sumAmounts(result.monthly.map((m) => m.total)), 356.78);
    assert.deepEqual(result.categories.map((c) => c.key), ["2"]);
    assert.equal(result.overview.previousTotal, 0);
    assert.equal(result.overview.periodChangePct, null);
  });

  it("averages a year over elapsed months only", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: [],
      expenses: records,
      nameOf,
      selection: { kind: "year", year: 2026 },
      today: new Date(2026, 1, 15), // February → 2 months elapsed
    });
    assert.equal(result.overview.monthsCounted, 2);
    assert.equal(result.overview.averageMonthlySpending, 379.22 / 2);
  });

  it("returns safe zeros and nulls for an empty dataset", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: [],
      expenses: [],
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today,
    });
    const o = result.overview;
    assert.equal(o.totalSpending, 0);
    assert.equal(o.transactionCount, 0);
    assert.equal(o.averageMonthlySpending, 0);
    assert.equal(o.averageTransaction, 0);
    assert.equal(o.highestCategory, null);
    assert.equal(o.periodChangePct, null);
    assert.equal(o.budgetUtilisation, null);
    assert.equal(result.budgets, null);
    assert.deepEqual(result.categories, []);
    assert.ok(!Number.isNaN(o.averageMonthlySpending));
  });

  it("budgets are null (unavailable) rather than zero when not loaded", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: [],
      expenses: records,
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today,
    });
    assert.equal(result.budgets, null);
    assert.equal(result.overview.budgetUtilisation, null);
  });

  it("does not count a refund-only category as the highest category", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: [],
      expenses: [exp("2026-01-01", -20, "3")],
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today,
    });
    assert.equal(result.overview.highestCategory, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. CSV export
// ─────────────────────────────────────────────────────────────────────────────

describe("CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    assert.equal(escapeCsvCell("Fish, chips"), '"Fish, chips"');
    assert.equal(escapeCsvCell('Joe "Pie"'), '"Joe ""Pie"""');
    assert.equal(escapeCsvCell("a\nb"), '"a\nb"');
  });

  it("neutralises spreadsheet formula injection", () => {
    assert.equal(escapeCsvCell("=HYPERLINK(\"x\")"), "\"'=HYPERLINK(\"\"x\"\")\"");
    assert.equal(escapeCsvCell("+1"), "'+1");
    assert.equal(escapeCsvCell("-1"), "'-1");
    assert.equal(escapeCsvCell("@SUM(A1)"), "'@SUM(A1)");
  });

  it("writes numbers (including negatives) as plain numbers", () => {
    assert.equal(escapeCsvCell(-12.5), "-12.5");
    assert.equal(escapeCsvCell(0), "0");
    assert.equal(escapeCsvCell(Number.NaN), "");
  });

  it("writes empty cells for null and undefined", () => {
    assert.equal(toCsv(["a", "b"], [[null, undefined]]), "a,b\r\n,");
  });

  it("category CSV rows reconcile with the category totals", () => {
    const records = [exp("2026-01-01", 10.55, "1"), exp("2026-01-02", 4.45, "2"), exp("2026-01-03", 0.1, "2")];
    const cats = groupByCategory(records, nameOf);
    const lines = categoryBreakdownCsv(cats).split("\r\n");
    assert.equal(lines[0], "Category,Total (GBP),Share of spending (%),Transactions,Average transaction (GBP)");
    assert.deepEqual(
      lines.slice(1).map((l) => Number(l.split(",")[1])),
      cats.map((c) => c.total),
    );
    assert.equal(sumAmounts(lines.slice(1).map((l) => Number(l.split(",")[1]))), referenceTotal(records));
  });

  it("full report contains every section and the period", () => {
    const result = buildAnalytics({
      budgets: [budget(2026, 1, "1", 50)],
      categoryKeys: [],
      expenses: [exp("2026-01-05", 25, "1")],
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today: new Date(2026, 0, 20),
    });
    const csv = fullReportCsv(result, new Date(Date.UTC(2026, 0, 20)));
    for (const heading of ["Overview", "Monthly expense summary", "Category spending breakdown", "Budget performance summary"]) {
      assert.ok(csv.includes(heading), heading);
    }
    assert.ok(csv.includes(formatRangeLabel(result.range)));
    assert.ok(csv.includes("Total spending (GBP),25"));
  });

  it("full report omits the budget section when budgets are unavailable", () => {
    const result = buildAnalytics({
      budgets: null,
      categoryKeys: [],
      expenses: [],
      nameOf,
      selection: { kind: "month", month: 0, year: 2026 },
      today: new Date(2026, 0, 20),
    });
    assert.ok(!fullReportCsv(result, new Date()).includes("Budget performance summary"));
  });
});
