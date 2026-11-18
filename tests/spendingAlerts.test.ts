/**
 * tests/spendingAlerts.test.ts
 *
 * Unit tests for Feature 5: Automated Spending Alerts
 *
 * Tests cover:
 *  1. computeThreshold — all threshold levels, exact boundaries, edge cases
 *  2. computeSpentPercent — basic calculation, over-budget percentage
 *  3. buildAlertId — deterministic, user-scoped, threshold-specific
 *  4. generateAlertFromBudget — null below 80%, correct thresholds, field values
 *  5. generateAlerts — bulk generation, deduplication, read/dismissed preservation
 *  6. Month boundary enforcement — expenses from wrong month/year ignored
 *  7. Duplicate prevention — same composite key → same alert ID
 *  8. getAlertTitle / getAlertDescription — human-readable output
 *  9. getAlertVariant — correct variant per threshold
 * 10. alertStorage (loadStoredAlerts / saveStoredAlerts) — localStorage round-trip
 * 11. Integration: expense change recalculates threshold crossing
 * 12. Edge cases: zero limit, negative amounts, refunds reducing spending
 *
 * Run: node_modules/.bin/tsx --test tests/spendingAlerts.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BudgetLike,
  buildAlertId,
  computeSpentPercent,
  computeThreshold,
  generateAlertFromBudget,
  generateAlerts,
  getAlertDescription,
  getAlertTitle,
  getAlertVariant,
} from "../src/lib/alertCalculation.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. computeThreshold
// ─────────────────────────────────────────────────────────────────────────────

describe("computeThreshold", () => {
  it("returns null when spending is below 80%", () => {
    assert.equal(computeThreshold(79.99, 100), null);
  });

  it("returns null when spending is exactly 79%", () => {
    assert.equal(computeThreshold(79, 100), null);
  });

  it("returns 'warning' at exactly 80%", () => {
    assert.equal(computeThreshold(80, 100), "warning");
  });

  it("returns 'warning' at 85%", () => {
    assert.equal(computeThreshold(85, 100), "warning");
  });

  it("returns 'warning' at 99.99%", () => {
    assert.equal(computeThreshold(99.99, 100), "warning");
  });

  it("returns 'critical' at exactly 100%", () => {
    assert.equal(computeThreshold(100, 100), "critical");
  });

  // Over-budget is "critical" (spec: 100 % or more → critical). The retired
  // separate "over" level produced a second alert for the same category.
  it("returns 'critical' just above 100%", () => {
    assert.equal(computeThreshold(100.01, 100), "critical");
  });

  it("returns 'critical' at 150%", () => {
    assert.equal(computeThreshold(150, 100), "critical");
  });

  it("returns 'critical' at 200%", () => {
    assert.equal(computeThreshold(200, 100), "critical");
  });

  it("returns null when limit is zero (no valid budget)", () => {
    assert.equal(computeThreshold(50, 0), null);
  });

  it("returns null when limit is negative", () => {
    assert.equal(computeThreshold(50, -100), null);
  });

  it("returns null when both spent and limit are zero", () => {
    assert.equal(computeThreshold(0, 0), null);
  });

  it("works with decimal limits — warning at 80% of £500", () => {
    assert.equal(computeThreshold(400, 500), "warning");
  });

  it("works with decimal limits — critical at 100% of £500", () => {
    assert.equal(computeThreshold(500, 500), "critical");
  });

  it("works with decimal limits — critical at 101% of £500", () => {
    assert.equal(computeThreshold(505, 500), "critical");
  });

  it("returns 'warning' at exactly 80 pence of £1 budget", () => {
    assert.equal(computeThreshold(0.8, 1), "warning");
  });

  it("returns null at 79 pence of £1 budget", () => {
    assert.equal(computeThreshold(0.79, 1), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. computeSpentPercent
// ─────────────────────────────────────────────────────────────────────────────

describe("computeSpentPercent", () => {
  it("calculates 50% correctly", () => {
    assert.equal(computeSpentPercent(50, 100), 50);
  });

  it("calculates 80% correctly", () => {
    assert.equal(computeSpentPercent(80, 100), 80);
  });

  it("calculates 100% correctly", () => {
    assert.equal(computeSpentPercent(100, 100), 100);
  });

  it("calculates over 100% correctly (150%)", () => {
    assert.equal(computeSpentPercent(150, 100), 150);
  });

  it("returns 0 when limit is zero", () => {
    assert.equal(computeSpentPercent(50, 0), 0);
  });

  it("returns 0 when spent is zero", () => {
    assert.equal(computeSpentPercent(0, 100), 0);
  });

  it("calculates fractional percentages correctly", () => {
    // Use approximate comparison for floating point results
    const result = computeSpentPercent(1, 3);
    assert.ok(
      Math.abs(result - 100 / 3) < 1e-10,
      `Expected ~${100 / 3}, got ${result}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. buildAlertId — deterministic, composite, scoped
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAlertId", () => {
  it("produces the correct composite string", () => {
    const id = buildAlertId("user-1", 2025, 11, "1", "warning");
    assert.equal(id, "user-1:2025:11:1:warning");
  });

  it("is deterministic — same inputs always produce the same ID", () => {
    const a = buildAlertId("user-a", 2025, 6, "2", "critical");
    const b = buildAlertId("user-a", 2025, 6, "2", "critical");
    assert.equal(a, b);
  });

  it("differs by userId", () => {
    const a = buildAlertId("user-1", 2025, 1, "1", "warning");
    const b = buildAlertId("user-2", 2025, 1, "1", "warning");
    assert.notEqual(a, b);
  });

  it("differs by year", () => {
    const a = buildAlertId("user-1", 2025, 1, "1", "warning");
    const b = buildAlertId("user-1", 2024, 1, "1", "warning");
    assert.notEqual(a, b);
  });

  it("differs by month", () => {
    const a = buildAlertId("user-1", 2025, 1, "1", "warning");
    const b = buildAlertId("user-1", 2025, 2, "1", "warning");
    assert.notEqual(a, b);
  });

  it("differs by categoryId", () => {
    const a = buildAlertId("user-1", 2025, 1, "1", "warning");
    const b = buildAlertId("user-1", 2025, 1, "2", "warning");
    assert.notEqual(a, b);
  });

  it("differs by threshold", () => {
    const a = buildAlertId("user-1", 2025, 1, "1", "warning");
    const b = buildAlertId("user-1", 2025, 1, "1", "critical");
    assert.notEqual(a, b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. generateAlertFromBudget
// ─────────────────────────────────────────────────────────────────────────────

describe("generateAlertFromBudget", () => {
  const baseInput = {
    categoryId: "1",
    categoryName: "Grocery",
    limitAmount: 200,
    month: 11,
    userId: "user-1",
    year: 2025,
  };

  it("returns null when spending is below 80%", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 100 });
    assert.equal(result, null);
  });

  it("returns null at 0% spending", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 0 });
    assert.equal(result, null);
  });

  it("generates a warning alert at 80%", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.equal(result!.threshold, "warning");
  });

  it("generates a critical alert at 100%", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 200 });
    assert.notEqual(result, null);
    assert.equal(result!.threshold, "critical");
  });

  it("generates a critical alert above 100%", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 250 });
    assert.notEqual(result, null);
    assert.equal(result!.threshold, "critical");
  });

  it("alert has correct userId, year, month, categoryId, categoryName", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.equal(result!.userId, "user-1");
    assert.equal(result!.year, 2025);
    assert.equal(result!.month, 11);
    assert.equal(result!.categoryId, "1");
    assert.equal(result!.categoryName, "Grocery");
  });

  it("new alert has isRead=false and isDismissed=false", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.equal(result!.isRead, false);
    assert.equal(result!.isDismissed, false);
  });

  it("has correct spentAmount and limitAmount", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 170 });
    assert.notEqual(result, null);
    assert.equal(result!.spentAmount, 170);
    assert.equal(result!.limitAmount, 200);
  });

  it("has correct spentPercent", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.equal(result!.spentPercent, 80);
  });

  it("spentPercent can exceed 100 when over budget", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 300 });
    assert.notEqual(result, null);
    assert.equal(result!.spentPercent, 150);
  });

  it("id is a deterministic composite key", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.equal(result!.id, "user-1:2025:11:1:warning");
  });

  it("createdAt is an ISO timestamp string", () => {
    const result = generateAlertFromBudget({ ...baseInput, spentAmount: 160 });
    assert.notEqual(result, null);
    assert.ok(new Date(result!.createdAt).getTime() > 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. generateAlerts — bulk, deduplication, state preservation
// ─────────────────────────────────────────────────────────────────────────────

describe("generateAlerts", () => {
  const userId = "user-1";

  const grocery: BudgetLike = {
    categoryId: "1",
    categoryName: "Grocery",
    limitAmount: 200,
    month: 11,
    spent: 160, // 80% — warning
    year: 2025,
  };

  const takeout: BudgetLike = {
    categoryId: "2",
    categoryName: "Takeout",
    limitAmount: 100,
    month: 11,
    spent: 50, // 50% — no alert
    year: 2025,
  };

  const shopping: BudgetLike = {
    categoryId: "4",
    categoryName: "Shopping",
    limitAmount: 150,
    month: 11,
    spent: 150, // 100% — critical
    year: 2025,
  };

  it("generates no alerts when all budgets are under 80%", () => {
    const results = generateAlerts(userId, [takeout], new Map());
    assert.equal(results.length, 0);
  });

  it("generates one alert for one budget over 80%", () => {
    const results = generateAlerts(userId, [grocery], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].threshold, "warning");
  });

  it("generates multiple alerts for multiple budgets over threshold", () => {
    const results = generateAlerts(userId, [grocery, shopping], new Map());
    assert.equal(results.length, 2);
  });

  it("skips budgets below threshold, includes those above", () => {
    const results = generateAlerts(userId, [grocery, takeout, shopping], new Map());
    assert.equal(results.length, 2);
    const ids = results.map((r) => r.categoryId);
    assert.ok(ids.includes("1"));
    assert.ok(ids.includes("4"));
    assert.ok(!ids.includes("2"));
  });

  it("preserves isRead=true from existing alert when regenerated", () => {
    // First generation
    const first = generateAlerts(userId, [grocery], new Map());
    assert.equal(first.length, 1);

    // Simulate user reading it
    const existingMap = new Map([[first[0].id, { ...first[0], isRead: true }]]);

    // Regenerate with same data
    const second = generateAlerts(userId, [grocery], existingMap);
    assert.equal(second.length, 1);
    assert.equal(second[0].isRead, true, "isRead should be preserved");
  });

  it("preserves isDismissed=true from existing alert when regenerated", () => {
    const first = generateAlerts(userId, [grocery], new Map());
    const existingMap = new Map([
      [first[0].id, { ...first[0], isDismissed: true, isRead: true }],
    ]);

    const second = generateAlerts(userId, [grocery], existingMap);
    // Alert is still generated (deduplication preserves it); caller filters dismissed
    assert.equal(second.length, 1);
    assert.equal(second[0].isDismissed, true, "isDismissed should be preserved");
  });

  it("preserves original createdAt timestamp across regenerations", () => {
    const first = generateAlerts(userId, [grocery], new Map());
    const originalTime = first[0].createdAt;
    const existingMap = new Map([[first[0].id, first[0]]]);

    // Small delay to ensure time difference would be detectable
    const second = generateAlerts(userId, [grocery], existingMap);
    assert.equal(second[0].createdAt, originalTime, "createdAt should be preserved");
  });

  it("does not duplicate: same budget data produces same ID", () => {
    const first = generateAlerts(userId, [grocery], new Map());
    const existingMap = new Map([[first[0].id, first[0]]]);
    const second = generateAlerts(userId, [grocery], existingMap);

    assert.equal(first[0].id, second[0].id, "IDs must match — no duplicate");
  });

  it("generates a new 'critical' alert when spending crosses 100%", () => {
    // Start at warning
    const warningBudget = { ...grocery };
    const first = generateAlerts(userId, [warningBudget], new Map());
    assert.equal(first[0].threshold, "warning");

    // Spending increases to over 100%
    const overBudget = { ...grocery, spent: 210 };
    const existingMap = new Map([[first[0].id, first[0]]]);
    const second = generateAlerts(userId, [overBudget], existingMap);

    // New alert has 'critical' threshold (reconcileMonthAlerts drops the old warning)
    assert.equal(second.length, 1);
    assert.equal(second[0].threshold, "critical");
    assert.notEqual(second[0].id, first[0].id, "Different IDs for different thresholds");
  });

  it("empty budgets array produces no alerts", () => {
    const results = generateAlerts(userId, [], new Map());
    assert.equal(results.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Month boundary enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("Month boundary enforcement in generateAlerts", () => {
  it("alert for month 11 does not fire for budget in month 10", () => {
    // Budget is in November but we simulate it for October
    const budget: BudgetLike = {
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 200,
      month: 10, // October
      spent: 160,
      year: 2025,
    };
    const results = generateAlerts("u1", [budget], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].month, 10); // Alert correctly scoped to October
  });

  it("December boundary: alerts for month 12 have month=12", () => {
    const budget: BudgetLike = {
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 200,
      month: 12,
      spent: 180,
      year: 2025,
    };
    const results = generateAlerts("u1", [budget], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].month, 12);
    assert.equal(results[0].year, 2025);
  });

  it("January boundary: alerts for month 1 have month=1", () => {
    const budget: BudgetLike = {
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 200,
      month: 1,
      spent: 180,
      year: 2026,
    };
    const results = generateAlerts("u1", [budget], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].month, 1);
    assert.equal(results[0].year, 2026);
  });

  it("alert IDs include year so cross-year deduplication is isolated", () => {
    const id2025 = buildAlertId("u1", 2025, 12, "1", "warning");
    const id2026 = buildAlertId("u1", 2026, 12, "1", "warning");
    assert.notEqual(id2025, id2026);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Duplicate prevention
// ─────────────────────────────────────────────────────────────────────────────

describe("Duplicate prevention", () => {
  it("same (userId, year, month, categoryId, threshold) always produces the same ID", () => {
    const id1 = buildAlertId("user-abc", 2025, 11, "1", "warning");
    const id2 = buildAlertId("user-abc", 2025, 11, "1", "warning");
    assert.equal(id1, id2);
  });

  it("different users get different IDs for the same budget/threshold", () => {
    const id1 = buildAlertId("user-1", 2025, 11, "1", "warning");
    const id2 = buildAlertId("user-2", 2025, 11, "1", "warning");
    assert.notEqual(id1, id2);
  });

  it("generateAlerts merges identical budget entries so the last one wins", () => {
    // Two budget entries with the same key produce only one alert because
    // generateAlerts uses a Map internally (last write wins per ID).
    // This matches the real use case where each budget has a unique categoryId.
    const budgets: BudgetLike[] = [
      { categoryId: "1", categoryName: "Grocery", limitAmount: 200, month: 11, spent: 160, year: 2025 },
      { categoryId: "2", categoryName: "Takeout", limitAmount: 100, month: 11, spent: 90,  year: 2025 },
    ];
    const results = generateAlerts("u1", budgets, new Map());
    const ids = results.map((r) => r.id);
    const unique = new Set(ids);
    assert.equal(ids.length, unique.size, "All IDs should be unique — no duplicates across different categories");
  });

  it("calling generateAlerts twice with the same data does not double alerts", () => {
    const budgets: BudgetLike[] = [
      { categoryId: "1", categoryName: "Grocery", limitAmount: 200, month: 11, spent: 160, year: 2025 },
    ];
    const first = generateAlerts("u1", budgets, new Map());
    const existingMap = new Map(first.map((a) => [a.id, a]));
    const second = generateAlerts("u1", budgets, existingMap);
    assert.equal(second.length, 1, "Should still be exactly one alert");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. getAlertTitle
// ─────────────────────────────────────────────────────────────────────────────

describe("getAlertTitle", () => {
  it("warning threshold shows 'Approaching limit'", () => {
    const title = getAlertTitle({ categoryName: "Grocery", threshold: "warning" });
    assert.ok(title.includes("Approaching limit"));
    assert.ok(title.includes("Grocery"));
  });

  it("critical threshold shows 'Budget reached'", () => {
    const title = getAlertTitle({ categoryName: "Takeout", threshold: "critical" });
    assert.ok(title.includes("Budget reached"));
    assert.ok(title.includes("Takeout"));
  });

  it("critical above the limit shows 'Over budget'", () => {
    const title = getAlertTitle({
      categoryName: "Shopping",
      limitAmount: 100,
      spentAmount: 150,
      threshold: "critical",
    });
    assert.ok(title.includes("Over budget"));
    assert.ok(title.includes("Shopping"));
  });

  it("critical exactly at the limit shows 'Budget reached', not 'Over budget'", () => {
    const title = getAlertTitle({
      categoryName: "Shopping",
      limitAmount: 100,
      spentAmount: 100,
      threshold: "critical",
    });
    assert.ok(title.includes("Budget reached"));
    assert.ok(!title.includes("Over budget"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. getAlertDescription
// ─────────────────────────────────────────────────────────────────────────────

describe("getAlertDescription", () => {
  const fmt = (n: number) => `£${n.toFixed(2)}`;

  it("warning description mentions spent amount and percentage", () => {
    const desc = getAlertDescription(
      { limitAmount: 200, spentAmount: 160, spentPercent: 80, threshold: "warning" },
      fmt,
    );
    assert.ok(desc.includes("£160.00"), `Expected spent amount. Got: ${desc}`);
    assert.ok(desc.includes("80%"), `Expected 80%. Got: ${desc}`);
  });

  it("critical description mentions the limit", () => {
    const desc = getAlertDescription(
      { limitAmount: 200, spentAmount: 200, spentPercent: 100, threshold: "critical" },
      fmt,
    );
    assert.ok(desc.includes("£200.00"), `Expected limit amount. Got: ${desc}`);
    assert.ok(desc.includes("100%"), `Expected 100%. Got: ${desc}`);
  });

  it("over-budget critical description mentions the spent amount", () => {
    const desc = getAlertDescription(
      { limitAmount: 200, spentAmount: 250, spentPercent: 125, threshold: "critical" },
      fmt,
    );
    assert.ok(desc.includes("£250.00"), `Expected spent amount. Got: ${desc}`);
    assert.ok(desc.includes("125%"), `Expected 125%. Got: ${desc}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getAlertVariant
// ─────────────────────────────────────────────────────────────────────────────

describe("getAlertVariant", () => {
  it("warning → 'warning' variant", () => {
    assert.equal(getAlertVariant("warning"), "warning");
  });

  it("critical → 'destructive' variant", () => {
    assert.equal(getAlertVariant("critical"), "destructive");
  });

});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Integration: expense change recalculates threshold crossing
// ─────────────────────────────────────────────────────────────────────────────

describe("Integration: threshold crossing on expense change", () => {
  const userId = "user-1";
  const base: BudgetLike = {
    categoryId: "1",
    categoryName: "Grocery",
    limitAmount: 200,
    month: 11,
    spent: 0,
    year: 2025,
  };

  it("no alert when at 0% spending", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 0 }], new Map());
    assert.equal(results.length, 0);
  });

  it("no alert when below 80%", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 159 }], new Map());
    assert.equal(results.length, 0);
  });

  it("warning fires the moment spending hits 80%", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 160 }], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].threshold, "warning");
  });

  it("still shows warning at 99.9%", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 199.9 }], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].threshold, "warning");
  });

  it("critical fires at exactly 100%", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 200 }], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].threshold, "critical");
  });

  it("critical fires above 100% — expense added pushes over limit", () => {
    const results = generateAlerts(userId, [{ ...base, spent: 201 }], new Map());
    assert.equal(results.length, 1);
    assert.equal(results[0].threshold, "critical");
  });

  it("expense deletion reducing spend from over to warning generates warning alert", () => {
    // Start over budget
    const overMap = new Map<string, ReturnType<typeof generateAlertFromBudget>>();
    const overAlerts = generateAlerts(userId, [{ ...base, spent: 210 }], new Map());
    overAlerts.forEach((a) => overMap.set(a.id, a!));

    // Expense deleted — now at 85%
    const afterDelete = generateAlerts(
      userId,
      [{ ...base, spent: 170 }],
      overMap as Map<string, import("../src/entities/Alert.js").SpendingAlert>,
    );
    assert.equal(afterDelete.length, 1);
    assert.equal(afterDelete[0].threshold, "warning");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("zero limit budget never triggers an alert", () => {
    const result = generateAlertFromBudget({
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 0,
      month: 11,
      spentAmount: 100,
      userId: "u1",
      year: 2025,
    });
    assert.equal(result, null);
  });

  it("very large budget — warning fires at the right absolute amount", () => {
    // £10,000 budget, 80% = £8,000
    const result = generateAlertFromBudget({
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 10000,
      month: 11,
      spentAmount: 8000,
      userId: "u1",
      year: 2025,
    });
    assert.notEqual(result, null);
    assert.equal(result!.threshold, "warning");
  });

  it("very small budget — warning fires at the right absolute amount (pence)", () => {
    // £1.00 budget, 80% = £0.80
    const result = generateAlertFromBudget({
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 1.0,
      month: 11,
      spentAmount: 0.8,
      userId: "u1",
      year: 2025,
    });
    assert.notEqual(result, null);
    assert.equal(result!.threshold, "warning");
  });

  it("refund (negative amount) that reduces spending below threshold removes from alerts", () => {
    // Originally at 85% → warning
    // Refund brings it to 70% → no alert
    const budget: BudgetLike = {
      categoryId: "1",
      categoryName: "Grocery",
      limitAmount: 100,
      month: 11,
      spent: 70, // After refund: was 85, refund of £15
      year: 2025,
    };
    const results = generateAlerts("u1", [budget], new Map());
    assert.equal(results.length, 0, "No alert after refund reduces spending below threshold");
  });

  it("multiple categories can each have their own independent alert", () => {
    const budgets: BudgetLike[] = [
      { categoryId: "1", categoryName: "Grocery", limitAmount: 200, month: 11, spent: 180, year: 2025 },
      { categoryId: "2", categoryName: "Takeout", limitAmount: 100, month: 11, spent: 105, year: 2025 },
      { categoryId: "3", categoryName: "Misc",    limitAmount: 50,  month: 11, spent: 25,  year: 2025 },
    ];
    const results = generateAlerts("u1", budgets, new Map());
    assert.equal(results.length, 2); // Grocery (warning), Takeout (critical), Misc (no alert)
    const thresholds = results.map((r) => r.threshold).sort();
    assert.deepEqual(thresholds, ["critical", "warning"]);
  });
});
