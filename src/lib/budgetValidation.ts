/**
 * src/lib/budgetValidation.ts
 *
 * Pure, synchronous validation helpers for budget data.
 * No Supabase, no React, no side-effects.
 *
 * Mirrors the design of src/lib/expenseValidation.ts.
 */

import type {
  Budget,
  BudgetValidationResult,
  BudgetWithSpending,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@/entities/Budget";

// ---------------------------------------------------------------------------
// Constants — mirror DB CHECK constraints in the migration
// ---------------------------------------------------------------------------

/** Maximum storable limit in NUMERIC(12,2). */
export const MAX_BUDGET_LIMIT = 9_999_999_999.99;

/** Minimum budget limit — must be strictly positive. */
export const MIN_BUDGET_LIMIT = 0.01;

/** Valid month range (1-based). */
export const MIN_MONTH = 1;
export const MAX_MONTH = 12;

/** Valid year range (matches DB CHECK constraint). */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

// ---------------------------------------------------------------------------
// Individual field validators — return an error string or undefined
// ---------------------------------------------------------------------------

/** Validates a budget limit amount (must be > 0, ≤ MAX, ≤ 2 dp). */
export function validateBudgetLimit(limit: unknown): string | undefined {
  if (typeof limit !== "number" || !isFinite(limit) || isNaN(limit)) {
    return "Budget limit must be a finite number.";
  }
  if (limit <= 0) {
    return "Budget limit must be greater than zero.";
  }
  if (limit > MAX_BUDGET_LIMIT) {
    return `Budget limit must not exceed ${MAX_BUDGET_LIMIT.toLocaleString()}.`;
  }
  const rounded = Math.round(limit * 100) / 100;
  if (Math.abs(limit - rounded) > Number.EPSILON * 100) {
    return "Budget limit must have at most 2 decimal places.";
  }
  return undefined;
}

/** Validates a month value (1–12). */
export function validateMonth(month: unknown): string | undefined {
  if (typeof month !== "number" || !Number.isInteger(month)) {
    return "Month must be an integer.";
  }
  if (month < MIN_MONTH || month > MAX_MONTH) {
    return `Month must be between ${MIN_MONTH} and ${MAX_MONTH}.`;
  }
  return undefined;
}

/** Validates a year value (2000–2100). */
export function validateYear(year: unknown): string | undefined {
  if (typeof year !== "number" || !Number.isInteger(year)) {
    return "Year must be an integer.";
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`;
  }
  return undefined;
}

/** Validates a categoryId (non-empty string). */
export function validateCategoryId(categoryId: unknown): string | undefined {
  if (typeof categoryId !== "string" || categoryId.trim() === "") {
    return "Category is required.";
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Composite validators
// ---------------------------------------------------------------------------

/**
 * Validates a CreateBudgetInput.
 *
 * @returns `{ valid: true }` on success, or `{ valid: false, errors }` listing all problems.
 */
export function validateCreateBudgetInput(
  input: CreateBudgetInput,
): BudgetValidationResult {
  const errors: string[] = [];

  const limitErr = validateBudgetLimit(input.limitAmount);
  if (limitErr) errors.push(limitErr);

  const monthErr = validateMonth(input.month);
  if (monthErr) errors.push(monthErr);

  const yearErr = validateYear(input.year);
  if (yearErr) errors.push(yearErr);

  const catErr = validateCategoryId(input.categoryId);
  if (catErr) errors.push(catErr);

  return errors.length === 0 ? { valid: true } : { errors, valid: false };
}

/**
 * Validates an UpdateBudgetInput.
 * Only validates fields that are present (partial update).
 */
export function validateUpdateBudgetInput(
  input: UpdateBudgetInput,
): BudgetValidationResult {
  const errors: string[] = [];

  if (!input.id || typeof input.id !== "string" || input.id.trim() === "") {
    errors.push("Budget ID is required for updates.");
  }

  if (input.limitAmount !== undefined) {
    const limitErr = validateBudgetLimit(input.limitAmount);
    if (limitErr) errors.push(limitErr);
  }

  return errors.length === 0 ? { valid: true } : { errors, valid: false };
}

/**
 * Throws a TypeError if CreateBudgetInput validation fails.
 */
export function assertValidCreateBudgetInput(input: CreateBudgetInput): void {
  const result = validateCreateBudgetInput(input);
  if (!result.valid) {
    throw new TypeError(`Invalid budget data: ${result.errors.join("; ")}`);
  }
}

/**
 * Throws a TypeError if UpdateBudgetInput validation fails.
 */
export function assertValidUpdateBudgetInput(input: UpdateBudgetInput): void {
  const result = validateUpdateBudgetInput(input);
  if (!result.valid) {
    throw new TypeError(`Invalid budget update: ${result.errors.join("; ")}`);
  }
}

// ---------------------------------------------------------------------------
// Business rule: duplicate detection helper
// ---------------------------------------------------------------------------

/**
 * Returns true if `existing` already contains a budget for the same
 * year/month/categoryId combination — used to prevent duplicate budgets.
 */
export function isDuplicateBudget(
  existing: Array<{ year: number; month: number; categoryId: string; id?: string }>,
  input: CreateBudgetInput,
  /** If editing, pass the ID of the budget being edited to exclude it from the check. */
  excludeId?: string,
): boolean {
  return existing.some(
    (b) =>
      b.year === input.year &&
      b.month === input.month &&
      b.categoryId === input.categoryId &&
      b.id !== excludeId,
  );
}

// ---------------------------------------------------------------------------
// Spending calculation helpers — used by useBudgets hook
// ---------------------------------------------------------------------------

/**
 * Canonical form of a category ID for comparisons. Budgets and expenses both
 * store the text ID from DEFAULT_CATEGORIES ("1" = Grocery), never the display
 * name. Normalising guards against a numeric 1 or stray whitespace (" 1")
 * from an import or a column-type change silently dropping spending from a
 * budget. Display names are NOT mapped: "Grocery" does not match "1".
 */
export function normaliseCategoryId(id: unknown): string | null {
  if (id === null || id === undefined) return null;
  const value = String(id).trim();
  return value === "" ? null : value;
}

/** True when both values are the same (non-empty) category ID. */
export function sameCategoryId(a: unknown, b: unknown): boolean {
  const left = normaliseCategoryId(a);
  return left !== null && left === normaliseCategoryId(b);
}

/**
 * Calculates the total amount spent in a given category/month/year from a
 * flat array of expenses.
 *
 * Only positive (debit) amounts count toward budget consumption.
 * Negative amounts (refunds) reduce the spending total.
 */
export function calculateCategorySpending(
  expenses: Array<{ amount: number; categoryId: string | number | null; date: Date | string }>,
  categoryId: string,
  year: number,
  month: number, // 1-based
): number {
  return expenses
    .filter((e) => {
      if (!sameCategoryId(e.categoryId, categoryId)) return false;
      // Normalise date
      const d = e.date instanceof Date ? e.date : new Date(e.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Clamps a progress percentage to [0, 100] for the progress bar.
 */
export function clampProgressPercent(spent: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.max(0, (spent / limit) * 100));
}

/**
 * Joins one month's budget rows with that month's expenses (the calculation
 * useBudgets has always done, moved here so it can be unit-tested).
 *
 * @param categoryNames category ID → display name (DEFAULT_CATEGORIES); the
 *   name is for display only, matching is always by ID.
 */
export function computeBudgetsWithSpending(
  budgets: Budget[],
  expenses: Array<{ amount: number; categoryId: string | number | null; date: Date | string }>,
  year: number,
  month: number, // 1-based
  categoryNames: ReadonlyMap<string, string>,
): BudgetWithSpending[] {
  return budgets.map((budget) => {
    const spent = calculateCategorySpending(expenses, budget.categoryId, year, month);
    const remaining = budget.limitAmount - spent;
    const progressPercent = clampProgressPercent(spent, budget.limitAmount);
    const id = normaliseCategoryId(budget.categoryId);

    return {
      ...budget,
      categoryName: (id !== null && categoryNames.get(id)) || budget.categoryId,
      progressPercent,
      remaining,
      spent,
    };
  });
}
