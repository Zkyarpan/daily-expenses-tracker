/**
 * scripts/benchmark-analytics.ts
 *
 * Feature 6 performance measurement: times buildAnalytics() — the single
 * aggregation pass behind every analytics card, chart and report — on
 * synthetic datasets of increasing size, and checks the totals still
 * reconcile exactly with the input records.
 *
 * The data is randomly generated in memory for benchmarking only; it is never
 * written anywhere or shown in the app.
 *
 * Run: npm run bench:analytics
 */

import { performance } from "node:perf_hooks";

import {
  type AnalyticsBudget,
  type AnalyticsExpense,
  buildAnalytics,
  type PeriodSelection,
  sumAmounts,
} from "../src/lib/analytics";

// Deterministic PRNG (mulberry32) so runs are comparable.
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const makeExpenses = (n: number, years: number[]): AnalyticsExpense[] => {
  const rand = rng(n);
  return Array.from({ length: n }, (_, i) => {
    const year = years[Math.floor(rand() * years.length)];
    const month = Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 28);
    return {
      amount: Math.round((rand() * 120 + 1) * 100) / 100,
      categoryId: rand() < 0.03 ? null : String(1 + Math.floor(rand() * 9)),
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      id: `bench-${i}`,
    };
  });
};

const makeBudgets = (years: number[]): AnalyticsBudget[] =>
  years.flatMap((year) =>
    Array.from({ length: 12 }, (_, m) =>
      ["1", "2", "4"].map((categoryId) => ({ categoryId, limitAmount: 400, month: m + 1, year })),
    ).flat(),
  );

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const nameOf = (k: string) => `Category ${k}`;
const years = [2024, 2025, 2026];
const budgets = makeBudgets(years);
const today = new Date(2026, 10, 12);

const scenarios: Array<{ label: string; selection: PeriodSelection; categoryKeys: string[] }> = [
  { categoryKeys: [], label: "month", selection: { kind: "month", month: 5, year: 2026 } },
  { categoryKeys: [], label: "year", selection: { kind: "year", year: 2025 } },
  { categoryKeys: [], label: "custom 24 months", selection: { end: "2026-06-30", kind: "custom", start: "2024-07-01" } },
  { categoryKeys: ["1", "2"], label: "year + 2 categories", selection: { kind: "year", year: 2025 } },
];

const RUNS = 25;
console.log(`buildAnalytics benchmark — median of ${RUNS} runs (Node ${process.version})\n`);
console.log("records  | scenario             | median ms |   max ms | reconciles");
console.log("---------|----------------------|-----------|----------|-----------");

for (const n of [1_000, 10_000, 50_000]) {
  const expenses = makeExpenses(n, years);
  for (const s of scenarios) {
    // Warm-up (JIT)
    for (let i = 0; i < 3; i++) {
      buildAnalytics({ budgets, categoryKeys: s.categoryKeys, expenses, nameOf, selection: s.selection, today });
    }
    const times: number[] = [];
    let result = null as ReturnType<typeof buildAnalytics> | null;
    for (let i = 0; i < RUNS; i++) {
      const t0 = performance.now();
      result = buildAnalytics({ budgets, categoryKeys: s.categoryKeys, expenses, nameOf, selection: s.selection, today });
      times.push(performance.now() - t0);
    }
    const r = result!;
    const reference = sumAmounts(r.periodExpenses.map((e) => e.amount));
    const reconciles =
      r.overview.totalSpending === reference &&
      sumAmounts(r.monthly.map((m) => m.total)) === reference &&
      sumAmounts(r.categories.map((c) => c.total)) === reference;
    console.log(
      `${String(n).padStart(8)} | ${s.label.padEnd(20)} | ${median(times).toFixed(2).padStart(9)} | ${Math.max(...times).toFixed(2).padStart(8)} | ${reconciles ? "yes" : "NO"}`,
    );
    if (!reconciles) process.exitCode = 1;
  }
}
