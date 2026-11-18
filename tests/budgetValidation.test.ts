/**
 * tests/budgetValidation.test.ts
 *
 * Unit tests for src/lib/budgetValidation.ts
 *
 * Covers:
 *  1. validateBudgetLimit — positive, negative, zero, NaN, >2 dp, too large
 *  2. validateMonth — in-range, out-of-range, non-integer
 *  3. validateYear — in-range, out-of-range, non-integer
 *  4. validateCategoryId — empty, whitespace, valid string
 *  5. validateCreateBudgetInput — composite validation, error accumulation
 *  6. validateUpdateBudgetInput — id required, partial field validation
 *  7. isDuplicateBudget — detect and skip duplicates
 *  8. calculateCategorySpending — filtering, summing, mixed amounts
 *  9. clampProgressPercent — within bounds, over 100%, zero limit
 *
 * Run: node_modules/.bin/tsx --test tests/budgetValidation.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCategorySpending,
  clampProgressPercent,
  isDuplicateBudget,
  validateBudgetLimit,
  validateCategoryId,
  validateCreateBudgetInput,
  validateMonth,
  validateUpdateBudgetInput,
  validateYear,
} from "../src/lib/budgetValidation.js";

// ─────────────────────────────────────────────────────────────────────────────
// validateBudgetLimit
// ─────────────────────────────────────────────────────────────────────────────

describe("validateBudgetLimit", () => {
  it("accepts a valid positive limit", () => {
    assert.equal(validateBudgetLimit(100), undefined);
  });

  it("accepts minimum valid limit (0.01)", () => {
    assert.equal(validateBudgetLimit(0.01), undefined);
  });

  it("accepts maximum valid limit (9_999_999_999.99)", () => {
    assert.equal(validateBudgetLimit(9_999_999_999.99), undefined);
  });

  it("rejects zero", () => {
    assert.ok(validateBudgetLimit(0) !== undefined);
  });

  it("rejects negative amounts", () => {
    assert.ok(validateBudgetLimit(-50) !== undefined);
  });

  it("rejects NaN", () => {
    assert.ok(validateBudgetLimit(NaN) !== undefined);
  });

  it("rejects Infinity", () => {
    assert.ok(validateBudgetLimit(Infinity) !== undefined);
  });

  it("rejects amounts exceeding maximum", () => {
    assert.ok(validateBudgetLimit(10_000_000_000) !== undefined);
  });

  it("rejects amounts with more than 2 decimal places", () => {
    const err = validateBudgetLimit(99.999);
    assert.ok(err !== undefined);
    assert.ok(err!.includes("decimal"));
  });

  it("rejects a string", () => {
    assert.ok(validateBudgetLimit("100" as unknown as number) !== undefined);
  });

  it("rejects null", () => {
    assert.ok(validateBudgetLimit(null) !== undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateMonth
// ─────────────────────────────────────────────────────────────────────────────

describe("validateMonth", () => {
  it("accepts January (1)", () => assert.equal(validateMonth(1), undefined));
  it("accepts December (12)", () => assert.equal(validateMonth(12), undefined));
  it("accepts mid-year month (6)", () => assert.equal(validateMonth(6), undefined));

  it("rejects 0 (below range)", () => {
    assert.ok(validateMonth(0) !== undefined);
  });

  it("rejects 13 (above range)", () => {
    assert.ok(validateMonth(13) !== undefined);
  });

  it("rejects a float", () => {
    assert.ok(validateMonth(1.5) !== undefined);
  });

  it("rejects a string", () => {
    assert.ok(validateMonth("6" as unknown as number) !== undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateYear
// ─────────────────────────────────────────────────────────────────────────────

describe("validateYear", () => {
  it("accepts 2025", () => assert.equal(validateYear(2025), undefined));
  it("accepts boundary year 2000", () => assert.equal(validateYear(2000), undefined));
  it("accepts boundary year 2100", () => assert.equal(validateYear(2100), undefined));

  it("rejects 1999 (below range)", () => {
    assert.ok(validateYear(1999) !== undefined);
  });

  it("rejects 2101 (above range)", () => {
    assert.ok(validateYear(2101) !== undefined);
  });

  it("rejects a float", () => {
    assert.ok(validateYear(2025.5) !== undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCategoryId
// ─────────────────────────────────────────────────────────────────────────────

describe("validateCategoryId", () => {
  it("accepts a valid category id", () => {
    assert.equal(validateCategoryId("1"), undefined);
  });

  it("accepts multi-char id", () => {
    assert.equal(validateCategoryId("grocery"), undefined);
  });

  it("rejects empty string", () => {
    assert.ok(validateCategoryId("") !== undefined);
  });

  it("rejects whitespace-only string", () => {
    assert.ok(validateCategoryId("   ") !== undefined);
  });

  it("rejects null", () => {
    assert.ok(validateCategoryId(null) !== undefined);
  });

  it("rejects undefined", () => {
    assert.ok(validateCategoryId(undefined) !== undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateCreateBudgetInput
// ─────────────────────────────────────────────────────────────────────────────

describe("validateCreateBudgetInput", () => {
  const validInput = {
    categoryId: "1",
    limitAmount: 300,
    month: 11,
    year: 2025,
  };

  it("accepts a fully valid input", () => {
    const r = validateCreateBudgetInput(validInput);
    assert.equal(r.valid, true);
  });

  it("rejects negative limit", () => {
    const r = validateCreateBudgetInput({ ...validInput, limitAmount: -100 });
    assert.equal(r.valid, false);
    if (!r.valid) assert.ok(r.errors.length > 0);
  });

  it("rejects zero limit", () => {
    const r = validateCreateBudgetInput({ ...validInput, limitAmount: 0 });
    assert.equal(r.valid, false);
  });

  it("rejects invalid month", () => {
    const r = validateCreateBudgetInput({ ...validInput, month: 0 });
    assert.equal(r.valid, false);
  });

  it("rejects invalid year", () => {
    const r = validateCreateBudgetInput({ ...validInput, year: 1999 });
    assert.equal(r.valid, false);
  });

  it("rejects empty categoryId", () => {
    const r = validateCreateBudgetInput({ ...validInput, categoryId: "" });
    assert.equal(r.valid, false);
  });

  it("accumulates multiple errors", () => {
    const r = validateCreateBudgetInput({ ...validInput, categoryId: "", limitAmount: -1 });
    assert.equal(r.valid, false);
    if (!r.valid) assert.ok(r.errors.length >= 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateUpdateBudgetInput
// ─────────────────────────────────────────────────────────────────────────────

describe("validateUpdateBudgetInput", () => {
  it("accepts an id-only update (no limitAmount change)", () => {
    const r = validateUpdateBudgetInput({ id: "uuid-abc" });
    assert.equal(r.valid, true);
  });

  it("accepts a valid limit update", () => {
    const r = validateUpdateBudgetInput({ id: "uuid-abc", limitAmount: 500 });
    assert.equal(r.valid, true);
  });

  it("rejects an empty id", () => {
    const r = validateUpdateBudgetInput({ id: "" });
    assert.equal(r.valid, false);
  });

  it("rejects whitespace-only id", () => {
    const r = validateUpdateBudgetInput({ id: "   " });
    assert.equal(r.valid, false);
  });

  it("validates limitAmount when provided", () => {
    const r = validateUpdateBudgetInput({ id: "uuid", limitAmount: -10 });
    assert.equal(r.valid, false);
  });

  it("skips limitAmount validation when not provided", () => {
    const r = validateUpdateBudgetInput({ id: "uuid" });
    assert.equal(r.valid, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isDuplicateBudget
// ─────────────────────────────────────────────────────────────────────────────

describe("isDuplicateBudget", () => {
  const existing = [
    { categoryId: "1", id: "bgt-1", month: 11, year: 2025 },
    { categoryId: "2", id: "bgt-2", month: 11, year: 2025 },
    { categoryId: "1", id: "bgt-3", month: 10, year: 2025 },
  ];

  it("detects a duplicate (same year/month/category)", () => {
    assert.equal(
      isDuplicateBudget(existing, { categoryId: "1", limitAmount: 100, month: 11, year: 2025 }),
      true,
    );
  });

  it("allows a different category in the same month", () => {
    assert.equal(
      isDuplicateBudget(existing, { categoryId: "3", limitAmount: 100, month: 11, year: 2025 }),
      false,
    );
  });

  it("allows the same category in a different month", () => {
    assert.equal(
      isDuplicateBudget(existing, { categoryId: "1", limitAmount: 100, month: 9, year: 2025 }),
      false,
    );
  });

  it("allows the same category/month in a different year", () => {
    assert.equal(
      isDuplicateBudget(existing, { categoryId: "1", limitAmount: 100, month: 11, year: 2024 }),
      false,
    );
  });

  it("excludes the currently-edited budget id from duplicate check", () => {
    // When editing bgt-1, it should not flag itself as a duplicate
    assert.equal(
      isDuplicateBudget(
        existing,
        { categoryId: "1", limitAmount: 200, month: 11, year: 2025 },
        "bgt-1",
      ),
      false,
    );
  });

  it("returns false for empty existing list", () => {
    assert.equal(
      isDuplicateBudget([], { categoryId: "1", limitAmount: 100, month: 11, year: 2025 }),
      false,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calculateCategorySpending
// ─────────────────────────────────────────────────────────────────────────────

describe("calculateCategorySpending", () => {
  const expenses = [
    { amount: 50,   categoryId: "1", date: "2025-11-05" },
    { amount: 30,   categoryId: "1", date: "2025-11-10" },
    { amount: 10,   categoryId: "2", date: "2025-11-01" },
    { amount: 100,  categoryId: "1", date: "2025-10-15" }, // different month
    { amount: -5,   categoryId: "1", date: "2025-11-20" }, // refund
  ];

  it("sums spending for the correct category and month", () => {
    const result = calculateCategorySpending(expenses, "1", 2025, 11);
    // 50 + 30 + (-5) = 75
    assert.equal(result, 75);
  });

  it("returns 0 for a category with no expenses in the month", () => {
    const result = calculateCategorySpending(expenses, "3", 2025, 11);
    assert.equal(result, 0);
  });

  it("excludes expenses from a different month", () => {
    const result = calculateCategorySpending(expenses, "1", 2025, 10);
    assert.equal(result, 100);
  });

  it("returns 0 for an empty expenses array", () => {
    const result = calculateCategorySpending([], "1", 2025, 11);
    assert.equal(result, 0);
  });

  it("handles Date objects as the date field", () => {
    const expensesWithDates = [
      { amount: 75, categoryId: "1", date: new Date("2025-11-15") },
    ];
    const result = calculateCategorySpending(expensesWithDates, "1", 2025, 11);
    assert.equal(result, 75);
  });

  it("does not include expenses with null categoryId", () => {
    const expensesWithNull = [
      { amount: 100, categoryId: null, date: "2025-11-05" },
    ];
    const result = calculateCategorySpending(expensesWithNull, "1", 2025, 11);
    assert.equal(result, 0);
  });

  it("sums refunds correctly (negative amounts reduce total)", () => {
    const refundExpenses = [
      { amount: 200, categoryId: "1", date: "2025-11-01" },
      { amount: -50, categoryId: "1", date: "2025-11-15" }, // refund
    ];
    const result = calculateCategorySpending(refundExpenses, "1", 2025, 11);
    assert.equal(result, 150);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clampProgressPercent
// ─────────────────────────────────────────────────────────────────────────────

describe("clampProgressPercent", () => {
  it("returns 50 when spent is half the limit", () => {
    assert.equal(clampProgressPercent(50, 100), 50);
  });

  it("returns 100 when spent equals the limit", () => {
    assert.equal(clampProgressPercent(100, 100), 100);
  });

  it("clamps to 100 when over budget", () => {
    assert.equal(clampProgressPercent(150, 100), 100);
  });

  it("returns 0 when no spending", () => {
    assert.equal(clampProgressPercent(0, 100), 0);
  });

  it("returns 0 when limit is zero (avoid division by zero)", () => {
    assert.equal(clampProgressPercent(50, 0), 0);
  });

  it("returns 0 when limit is negative (guard)", () => {
    assert.equal(clampProgressPercent(50, -100), 0);
  });

  it("handles fractional percentages", () => {
    const result = clampProgressPercent(33, 100);
    assert.equal(result, 33);
  });

  it("handles 0.01% progress correctly", () => {
    const result = clampProgressPercent(0.01, 100);
    assert.ok(result > 0 && result < 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SQL migration — RLS assertions for budgets table
// ─────────────────────────────────────────────────────────────────────────────

describe("Budget migration SQL — static assertions", () => {
  it("migration file exists and is non-empty", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(sql.length > 100, "Migration file must be non-trivial");
  });

  it("migration enables RLS on budgets table", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(
      sql.includes("ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY"),
      "RLS must be enabled on budgets",
    );
  });

  it("migration has SELECT policy for budgets", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(sql.includes("budgets_select_own"), "SELECT policy must exist");
    assert.ok(sql.includes("user_id = auth.uid()"), "Must use auth.uid()");
  });

  it("migration has INSERT, UPDATE and DELETE policies for budgets", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(sql.includes("budgets_insert_own"), "INSERT policy must exist");
    assert.ok(sql.includes("budgets_update_own"), "UPDATE policy must exist");
    assert.ok(sql.includes("budgets_delete_own"), "DELETE policy must exist");
  });

  it("migration has UNIQUE constraint preventing duplicate budgets", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(
      sql.includes("budgets_unique_user_month_category"),
      "UNIQUE constraint must exist",
    );
  });

  it("migration has CHECK constraint preventing non-positive limit", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    assert.ok(
      sql.includes('CHECK ("limitAmount" > 0)'),
      "limitAmount CHECK constraint must exist",
    );
  });

  it("migration has no DROP TABLE or TRUNCATE", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../supabase/migrations/20240003000000_create_budgets.sql",
        import.meta.url,
      ),
    ).toString();
    const stripped = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    assert.ok(!stripped.includes("DROP TABLE"), "No DROP TABLE allowed");
    assert.ok(!stripped.includes("TRUNCATE"), "No TRUNCATE allowed");
    assert.ok(!stripped.includes("DISABLE ROW LEVEL"), "RLS must not be disabled");
  });
});
