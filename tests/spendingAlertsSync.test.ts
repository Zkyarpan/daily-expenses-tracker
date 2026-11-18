/**
 * tests/spendingAlertsSync.test.ts
 *
 * End-to-end tests for spending alerts below the React layer. They use the
 * same functions the hooks call:
 *   computeBudgetsWithSpending  (useBudgets)
 *   syncMonthAlerts             (useMonthAlertSync, run by AlertsProvider)
 *   loadAlertsIntoCache / updateAlerts (AlertsProvider mount + actions)
 *   invalidateSpendingQueries   (useExpenseMutations)
 * with a real QueryClient and an in-memory localStorage.
 *
 * Covers: thresholds, category-ID matching, account isolation, refresh
 * (reload), create/edit/delete of expenses and budgets, duplicate
 * prevention, mark-as-read and dismissal.
 *
 * Run: node_modules/.bin/tsx --test tests/spendingAlertsSync.test.ts
 */

import { QueryClient } from "@tanstack/react-query";
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import type { SpendingAlert } from "../src/entities/Alert.js";
import type { Budget } from "../src/entities/Budget.js";
import {
  computeThreshold,
  getAlertTitle,
  isAlertMonthRetained,
  isOverBudget,
  reconcileMonthAlerts,
} from "../src/lib/alertCalculation.js";
import { alertStorageKey, parseStoredAlerts, saveStoredAlerts } from "../src/lib/alertStorage.js";
import {
  activeAlerts,
  alertQueryKey,
  countUnread,
  dismissAlert,
  dismissAllAlerts,
  loadAlertsIntoCache,
  markAlertRead,
  markAllAlertsRead,
  syncMonthAlerts,
  updateAlerts,
} from "../src/lib/alertSync.js";
import {
  calculateCategorySpending,
  computeBudgetsWithSpending,
  sameCategoryId,
} from "../src/lib/budgetValidation.js";
import { DEFAULT_CATEGORIES } from "../src/lib/config.js";
import { invalidateSpendingQueries } from "../src/lib/spendingQueries.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test harness
// ─────────────────────────────────────────────────────────────────────────────

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.has(key) ? this.items.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, String(value));
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
  clear() {
    this.items.clear();
  }
  keys() {
    return [...this.items.keys()];
  }
}

const storage = new MemoryStorage();
// alertStorage reads window.localStorage; this test file runs in its own process.
(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: storage,
};

const USER_A = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const YEAR = 2026;
const NOV = 11; // 1-based
const NOW = new Date(2026, 10, 13, 12).getTime(); // 13 Nov 2026, local time

const CATEGORY_NAMES: ReadonlyMap<string, string> = new Map(
  DEFAULT_CATEGORIES.map((c) => [c.id, c.name]),
);

type TestExpense = { id: string; amount: number; categoryId: string | number | null; date: Date };

const day = (d: number, month0 = 10) => new Date(YEAR, month0, d);

/** November 2026 as reported: £1,201.78 in total, £1,000.00 of it Grocery. */
function november(): TestExpense[] {
  return [
    { amount: 600, categoryId: "1", date: day(3), id: "e1" }, // Grocery
    { amount: 400, categoryId: "1", date: day(10), id: "e2" }, // Grocery
    { amount: 120.5, categoryId: "2", date: day(5), id: "e3" }, // Takeout
    { amount: 81.28, categoryId: "7", date: day(8), id: "e4" }, // Petrol
  ];
}

function budget(categoryId: string, limitAmount: number, month = NOV, year = YEAR): Budget {
  return {
    categoryId,
    createdAt: new Date(NOW),
    id: `b-${year}-${month}-${categoryId}`,
    limitAmount,
    month,
    updatedAt: new Date(NOW),
    year,
  };
}

/** What useBudgets + useMonthAlertSync do after a query settles. */
function sync(
  qc: QueryClient,
  userId: string,
  budgets: Budget[],
  expenses: TestExpense[],
  month = NOV,
  year = YEAR,
) {
  const withSpending = computeBudgetsWithSpending(budgets, expenses, year, month, CATEGORY_NAMES);
  return syncMonthAlerts(qc, userId, year, month, withSpending, NOW);
}

const cached = (qc: QueryClient, userId: string) =>
  qc.getQueryData<SpendingAlert[]>(alertQueryKey(userId)) ?? [];

const stored = (userId: string) =>
  [...parseStoredAlerts(storage.getItem(alertStorageKey(userId)), userId).values()];

const forCategory = (alerts: SpendingAlert[], categoryId: string) =>
  alerts.filter((a) => a.categoryId === categoryId && a.year === YEAR && a.month === NOV);

let qc: QueryClient;
beforeEach(() => {
  storage.clear();
  qc = new QueryClient();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Thresholds
// ─────────────────────────────────────────────────────────────────────────────

describe("thresholds: <80% normal, 80–99.99% warning, ≥100% critical", () => {
  const cases: Array<[number, number, string | null]> = [
    [0, 500, null],
    [399.95, 500, null], // 79.99 %
    [400, 500, "warning"], // 80 %
    [450, 500, "warning"], // 90 %
    [499.95, 500, "warning"], // 99.99 %
    [500, 500, "critical"], // 100 %
    [500.01, 500, "critical"],
    [1000, 500, "critical"], // 200 %
  ];
  for (const [spent, limit, expected] of cases) {
    it(`£${spent} of £${limit} → ${expected ?? "normal"}`, () => {
      assert.equal(computeThreshold(spent, limit), expected);
    });
  }

  it("compares in pence, so float noise cannot drop a budget below 80 %", () => {
    const spent = 0.7 + 0.1; // 0.7999999999999999 in IEEE-754
    assert.ok(spent < 0.8);
    assert.equal(computeThreshold(spent, 1), "warning");
  });

  it("summed pence amounts that total exactly the limit are critical", () => {
    const expenses = [33.33, 33.33, 33.34].map((amount, i) => ({
      amount,
      categoryId: "1",
      date: day(i + 1),
    }));
    const spent = calculateCategorySpending(expenses, "1", YEAR, NOV);
    assert.equal(computeThreshold(spent, 100), "critical");
  });

  it("no valid limit (0, negative, NaN) → no alert", () => {
    assert.equal(computeThreshold(100, 0), null);
    assert.equal(computeThreshold(100, -5), null);
    assert.equal(computeThreshold(Number.NaN, 100), null);
  });

  it("isOverBudget is false exactly at the limit and true above it", () => {
    assert.equal(isOverBudget({ limitAmount: 500, spentAmount: 500 }), false);
    assert.equal(isOverBudget({ limitAmount: 500, spentAmount: 500.01 }), true);
  });
});

describe("reported case: £500 Grocery budget, £1,000 Grocery spending (Nov 2026)", () => {
  it("the fixture matches the reported totals (£1,201.78, £1,000 Grocery)", () => {
    const total = november().reduce((s, e) => s + e.amount, 0);
    assert.equal(Math.round(total * 100), 120178);
    assert.equal(calculateCategorySpending(november(), "1", YEAR, NOV), 1000);
  });

  it("shows exactly one critical, unread Grocery alert at 200 %", () => {
    sync(qc, USER_A, [budget("1", 500)], november());

    const alerts = cached(qc, USER_A);
    assert.equal(alerts.length, 1);
    const [grocery] = alerts;
    assert.equal(grocery.threshold, "critical");
    assert.equal(grocery.categoryId, "1");
    assert.equal(grocery.categoryName, "Grocery");
    assert.equal(grocery.spentAmount, 1000);
    assert.equal(grocery.limitAmount, 500);
    assert.equal(grocery.spentPercent, 200);
    assert.equal(grocery.year, 2026);
    assert.equal(grocery.month, 11);
    assert.equal(grocery.userId, USER_A);
    assert.equal(grocery.isRead, false);
    assert.equal(countUnread(alerts), 1);
    assert.match(getAlertTitle(grocery), /Grocery — Over budget/);
  });

  it("is persisted for the signed-in user", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    assert.equal(stored(USER_A).length, 1);
    assert.equal(stored(USER_A)[0].threshold, "critical");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Category matching (IDs, never display names)
// ─────────────────────────────────────────────────────────────────────────────

describe("category matching", () => {
  it("budgets and expenses match on the category ID", () => {
    const [grocery] = computeBudgetsWithSpending([budget("1", 500)], november(), YEAR, NOV, CATEGORY_NAMES);
    assert.equal(grocery.spent, 1000);
    assert.equal(grocery.categoryName, "Grocery");
  });

  it("a display name in categoryId does not match the ID", () => {
    assert.equal(sameCategoryId("Grocery", "1"), false);
    const spent = calculateCategorySpending(
      [{ amount: 1000, categoryId: "Grocery", date: day(3) }],
      "1",
      YEAR,
      NOV,
    );
    assert.equal(spent, 0);
  });

  it("a numeric or padded ID still matches the text ID", () => {
    assert.equal(sameCategoryId(1, "1"), true);
    assert.equal(sameCategoryId(" 1 ", "1"), true);
    const spent = calculateCategorySpending(
      [
        { amount: 300, categoryId: 1, date: day(3) },
        { amount: 200, categoryId: " 1", date: day(4) },
      ],
      "1",
      YEAR,
      NOV,
    );
    assert.equal(spent, 500);
  });

  it("uncategorised expenses never count toward a budget", () => {
    assert.equal(sameCategoryId(null, "1"), false);
    assert.equal(sameCategoryId("", ""), false);
    const spent = calculateCategorySpending([{ amount: 999, categoryId: null, date: day(3) }], "1", YEAR, NOV);
    assert.equal(spent, 0);
  });

  it("other categories and other months are excluded", () => {
    const expenses = [
      ...november(),
      { amount: 5000, categoryId: "1", date: day(31, 9), id: "oct" }, // 31 Oct
      { amount: 5000, categoryId: "1", date: day(1, 11), id: "dec" }, // 1 Dec
    ];
    assert.equal(calculateCategorySpending(expenses, "1", YEAR, NOV), 1000);
    assert.equal(calculateCategorySpending(expenses, "2", YEAR, NOV), 120.5);
  });

  it("every configured category resolves to its own name", () => {
    for (const c of DEFAULT_CATEGORIES) {
      const [b] = computeBudgetsWithSpending([budget(c.id, 100)], [], YEAR, NOV, CATEGORY_NAMES);
      assert.equal(b.categoryName, c.name);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Account isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("account isolation", () => {
  it("one user's alerts are stored under their own key only", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    assert.deepEqual(storage.keys(), [alertStorageKey(USER_A)]);
    assert.equal(cached(qc, USER_B).length, 0);
  });

  it("a second account on the same browser starts with no alerts", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    loadAlertsIntoCache(qc, USER_B);
    assert.equal(cached(qc, USER_B).length, 0);
    sync(qc, USER_B, [], []);
    assert.equal(stored(USER_B).length, 0);
    assert.equal(stored(USER_A).length, 1, "B's sync must not touch A's alerts");
  });

  it("records of another user found under a key are ignored", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    // Simulate tampering / a bug copying A's list under B's key.
    storage.setItem(alertStorageKey(USER_B), storage.getItem(alertStorageKey(USER_A))!);
    loadAlertsIntoCache(qc, USER_B);
    assert.equal(cached(qc, USER_B).length, 0);
  });

  it("saveStoredAlerts never writes another user's record", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    saveStoredAlerts(USER_B, cached(qc, USER_A));
    assert.equal(storage.getItem(alertStorageKey(USER_B)), "[]");
  });

  it("reconcile drops other users' records from its input", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    const result = reconcileMonthAlerts(USER_B, YEAR, NOV, [], cached(qc, USER_A), NOW);
    assert.equal(result.length, 0);
  });

  it("alert IDs embed the user ID", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    sync(qc, USER_B, [budget("1", 500)], november());
    assert.notEqual(cached(qc, USER_A)[0].id, cached(qc, USER_B)[0].id);
    assert.ok(cached(qc, USER_B)[0].id.startsWith(`${USER_B}:`));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Refresh (page reload)
// ─────────────────────────────────────────────────────────────────────────────

describe("refresh", () => {
  it("read state survives a reload and a recalculation", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    const [alert] = cached(qc, USER_A);
    updateAlerts(qc, USER_A, (all) => markAlertRead(all, alert.id));

    const reloaded = new QueryClient(); // a fresh tab / hard refresh
    loadAlertsIntoCache(reloaded, USER_A);
    assert.equal(cached(reloaded, USER_A)[0].isRead, true);

    sync(reloaded, USER_A, [budget("1", 500)], november());
    const after = cached(reloaded, USER_A);
    assert.equal(after.length, 1, "no duplicate after reload");
    assert.equal(after[0].isRead, true);
    assert.equal(after[0].createdAt, alert.createdAt);
    assert.equal(countUnread(after), 0);
  });

  it("dismissed alerts stay dismissed after a reload and a recalculation", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    updateAlerts(qc, USER_A, (all) => dismissAlert(all, all[0].id));

    const reloaded = new QueryClient();
    loadAlertsIntoCache(reloaded, USER_A);
    sync(reloaded, USER_A, [budget("1", 500)], november());
    assert.equal(activeAlerts(cached(reloaded, USER_A)).length, 0);
  });

  it("a reload with fresh data still recalculates", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    const reloaded = new QueryClient();
    loadAlertsIntoCache(reloaded, USER_A);
    // Expenses deleted elsewhere (another device) while this tab was closed.
    sync(reloaded, USER_A, [budget("1", 500)], november().filter((e) => e.categoryId !== "1"));
    assert.equal(cached(reloaded, USER_A).length, 0);
  });

  it("alerts stored by older builds with the 'over' level load as one critical alert", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    const [critical] = stored(USER_A);
    const legacyOver = { ...critical, id: `${USER_A}:${YEAR}:${NOV}:1:over`, isRead: true, threshold: "over" };
    storage.setItem(alertStorageKey(USER_A), JSON.stringify([legacyOver, critical]));

    const alerts = stored(USER_A);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].threshold, "critical");
    assert.equal(alerts[0].id, `${USER_A}:${YEAR}:${NOV}:1:critical`);
  });

  it("corrupt storage is ignored instead of throwing", () => {
    storage.setItem(alertStorageKey(USER_A), "{not json");
    assert.deepEqual(stored(USER_A), []);
    storage.setItem(alertStorageKey(USER_A), JSON.stringify([{ id: 1 }, null, "x"]));
    assert.deepEqual(stored(USER_A), []);
    assert.equal(sync(qc, USER_A, [budget("1", 500)], november()), true);
    assert.equal(cached(qc, USER_A).length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CRUD updates
// ─────────────────────────────────────────────────────────────────────────────

describe("expense create / edit / delete updates alerts", () => {
  const budgets = [budget("1", 500)];

  it("create: normal → warning → critical, one alert at a time", () => {
    const expenses: TestExpense[] = [{ amount: 300, categoryId: "1", date: day(1), id: "a" }];
    sync(qc, USER_A, budgets, expenses);
    assert.equal(cached(qc, USER_A).length, 0, "60 % is normal");

    expenses.push({ amount: 100, categoryId: "1", date: day(2), id: "b" });
    sync(qc, USER_A, budgets, expenses);
    assert.deepEqual(cached(qc, USER_A).map((a) => a.threshold), ["warning"]);

    expenses.push({ amount: 600, categoryId: "1", date: day(3), id: "c" });
    sync(qc, USER_A, budgets, expenses);
    const grocery = forCategory(cached(qc, USER_A), "1");
    assert.deepEqual(grocery.map((a) => a.threshold), ["critical"], "the warning is replaced");
    assert.equal(grocery[0].isRead, false, "escalation is a new, unread alert");
  });

  it("edit amount: critical → warning", () => {
    const expenses = november();
    sync(qc, USER_A, budgets, expenses);
    expenses[0] = { ...expenses[0], amount: 50 }; // Grocery now £450 = 90 %
    sync(qc, USER_A, budgets, expenses);
    const grocery = forCategory(cached(qc, USER_A), "1");
    assert.deepEqual(grocery.map((a) => a.threshold), ["warning"]);
    assert.equal(grocery[0].spentAmount, 450);
  });

  it("edit amount within the same level updates the figures, keeps read state", () => {
    const expenses = november();
    sync(qc, USER_A, budgets, expenses);
    updateAlerts(qc, USER_A, markAllAlertsRead);
    expenses.push({ amount: 25, categoryId: "1", date: day(12), id: "e5" });
    sync(qc, USER_A, budgets, expenses);
    const [grocery] = cached(qc, USER_A);
    assert.equal(grocery.spentAmount, 1025);
    assert.equal(Math.round(grocery.spentPercent), 205); // shown as Math.round(%)
    assert.equal(grocery.isRead, true);
  });

  it("edit category: moving the spending out of Grocery clears its alert", () => {
    const expenses = november().map((e) => (e.categoryId === "1" ? { ...e, categoryId: "3" } : e));
    sync(qc, USER_A, budgets, november());
    sync(qc, USER_A, budgets, expenses);
    assert.equal(cached(qc, USER_A).length, 0);
  });

  it("edit date: moving the spending to another month clears this month's alert", () => {
    sync(qc, USER_A, budgets, november());
    const moved = november().map((e) => (e.categoryId === "1" ? { ...e, date: day(15, 9) } : e));
    sync(qc, USER_A, budgets, moved);
    assert.equal(cached(qc, USER_A).length, 0);
  });

  it("delete: removing Grocery expenses clears the alert", () => {
    sync(qc, USER_A, budgets, november());
    sync(qc, USER_A, budgets, november().filter((e) => e.id !== "e1")); // £400 = 80 %
    assert.deepEqual(cached(qc, USER_A).map((a) => a.threshold), ["warning"]);
    sync(qc, USER_A, budgets, november().filter((e) => e.categoryId !== "1"));
    assert.equal(cached(qc, USER_A).length, 0);
  });
});

describe("budget create / edit / delete updates alerts", () => {
  it("create: adding the £500 Grocery budget raises the alert", () => {
    sync(qc, USER_A, [], november());
    assert.equal(cached(qc, USER_A).length, 0);
    sync(qc, USER_A, [budget("1", 500)], november());
    assert.deepEqual(cached(qc, USER_A).map((a) => a.threshold), ["critical"]);
  });

  it("edit: raising the limit clears it, lowering it brings a warning", () => {
    sync(qc, USER_A, [budget("1", 500)], november());
    sync(qc, USER_A, [budget("1", 2000)], november()); // 50 %
    assert.equal(cached(qc, USER_A).length, 0);
    sync(qc, USER_A, [budget("1", 1100)], november()); // 90.9 %
    assert.deepEqual(cached(qc, USER_A).map((a) => a.threshold), ["warning"]);
  });

  it("delete: removing the budget clears its alert", () => {
    sync(qc, USER_A, [budget("1", 500), budget("2", 100)], november());
    assert.equal(cached(qc, USER_A).length, 2);
    sync(qc, USER_A, [budget("2", 100)], november());
    assert.deepEqual(cached(qc, USER_A).map((a) => a.categoryId), ["2"]);
  });

  it("recalculating one month leaves other months' alerts alone", () => {
    const october = [{ amount: 90, categoryId: "2", date: day(10, 9), id: "o1" }];
    sync(qc, USER_A, [budget("2", 100, 10)], october, 10);
    sync(qc, USER_A, [budget("1", 500)], november());
    sync(qc, USER_A, [], november()); // November budgets all deleted
    const alerts = cached(qc, USER_A);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].month, 10);
  });
});

describe("expense writes refresh every month's cache", () => {
  it("invalidates all expenses months, budgets and yearly caches, not unrelated ones", async () => {
    const client = new QueryClient();
    const keys = [
      ["expenses", 2026, 10], // November (0-based) — e.g. dated "Today"
      ["expenses", 2026, 9], // October — the month the page shows
      ["budgets", 2026, 11],
      ["budgets", "years", 2025, 2026],
      ["yearly-expenses", 2026],
    ];
    for (const key of keys) client.setQueryData(key, []);
    client.setQueryData(["trackers"], []);

    await invalidateSpendingQueries(client);

    for (const key of keys) {
      assert.equal(client.getQueryState(key)?.isInvalidated, true, `${JSON.stringify(key)} should be stale`);
    }
    assert.equal(client.getQueryState(["trackers"])?.isInvalidated, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Duplicates, read and dismiss
// ─────────────────────────────────────────────────────────────────────────────

describe("duplicate prevention", () => {
  it("recalculating unchanged data writes nothing and keeps one alert", () => {
    assert.equal(sync(qc, USER_A, [budget("1", 500)], november()), true);
    assert.equal(sync(qc, USER_A, [budget("1", 500)], november()), false);
    assert.equal(cached(qc, USER_A).length, 1);
  });

  it("the same month synced by the provider and the Budgets page stays single", () => {
    for (let i = 0; i < 5; i++) sync(qc, USER_A, [budget("1", 500)], november());
    assert.equal(stored(USER_A).length, 1);
  });

  it("a repeated budget row still yields one alert per category", () => {
    sync(qc, USER_A, [budget("1", 500), { ...budget("1", 500), id: "dup" }], november());
    assert.equal(forCategory(cached(qc, USER_A), "1").length, 1);
  });

  it("each category over its limit gets its own alert, critical first", () => {
    sync(qc, USER_A, [budget("1", 500), budget("2", 140), budget("7", 200)], november());
    // Grocery 200 % critical, Takeout 86 % warning, Petrol 41 % normal
    assert.deepEqual(
      cached(qc, USER_A).map((a) => [a.categoryName, a.threshold]),
      [["Grocery", "critical"], ["Takeout", "warning"]],
    );
  });
});

describe("mark as read and dismissal", () => {
  beforeEach(() => {
    sync(qc, USER_A, [budget("1", 500), budget("2", 140)], november());
  });

  it("mark as read lowers the unread count and persists", () => {
    assert.equal(countUnread(cached(qc, USER_A)), 2);
    const [first] = cached(qc, USER_A);
    updateAlerts(qc, USER_A, (all) => markAlertRead(all, first.id));
    assert.equal(countUnread(cached(qc, USER_A)), 1);
    assert.equal(stored(USER_A).find((a) => a.id === first.id)?.isRead, true);
  });

  it("mark all as read clears the count", () => {
    updateAlerts(qc, USER_A, markAllAlertsRead);
    assert.equal(countUnread(cached(qc, USER_A)), 0);
    assert.equal(activeAlerts(cached(qc, USER_A)).length, 2, "read alerts are still listed");
  });

  it("dismiss hides one alert; recalculation does not bring it back", () => {
    const [first] = cached(qc, USER_A);
    updateAlerts(qc, USER_A, (all) => dismissAlert(all, first.id));
    assert.equal(activeAlerts(cached(qc, USER_A)).length, 1);
    sync(qc, USER_A, [budget("1", 500), budget("2", 140)], november());
    assert.equal(activeAlerts(cached(qc, USER_A)).length, 1);
    assert.equal(countUnread(cached(qc, USER_A)), 1);
  });

  it("dismiss all hides everything", () => {
    updateAlerts(qc, USER_A, dismissAllAlerts);
    assert.equal(activeAlerts(cached(qc, USER_A)).length, 0);
    assert.equal(countUnread(cached(qc, USER_A)), 0);
  });

  it("a dismissed warning that escalates to critical alerts again", () => {
    const takeout = cached(qc, USER_A).find((a) => a.categoryId === "2")!;
    updateAlerts(qc, USER_A, (all) => dismissAlert(all, takeout.id));
    const more = [...november(), { amount: 30, categoryId: "2", date: day(12), id: "t2" }]; // £150.50
    sync(qc, USER_A, [budget("1", 500), budget("2", 140)], more);
    const next = activeAlerts(cached(qc, USER_A)).find((a) => a.categoryId === "2");
    assert.equal(next?.threshold, "critical");
    assert.equal(next?.isRead, false);
  });
});

describe("retention", () => {
  it("keeps 12 months of alerts and never regenerates older months", () => {
    assert.equal(isAlertMonthRetained(2025, 11, NOW), true);
    assert.equal(isAlertMonthRetained(2025, 10, NOW), false);

    sync(qc, USER_A, [budget("1", 10, 10, 2025)], [{ amount: 50, categoryId: "1", date: new Date(2025, 9, 5), id: "x" }], 10, 2025);
    assert.equal(cached(qc, USER_A).length, 0);
  });
});
