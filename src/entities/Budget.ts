/**
 * src/entities/Budget.ts
 *
 * Type definitions for Feature 4: Monthly Category Budget Management.
 */

// ---------------------------------------------------------------------------
// Core Budget type — mirrors the `budgets` Supabase table
// ---------------------------------------------------------------------------
export type Budget = {
  id: string;
  /** UUID of the authenticated owner — matches auth.users.id. */
  userId?: string;
  /** Calendar year (e.g. 2025). */
  year: number;
  /** 1-based month number: 1 = January … 12 = December. */
  month: number;
  /** Text category ID matching expenses.categoryId (e.g. "1" for Grocery). */
  categoryId: string;
  /** Maximum allowed spend for this category/month. Must be > 0. */
  limitAmount: number;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------
export type CreateBudgetInput = {
  year: number;
  month: number;
  categoryId: string;
  limitAmount: number;
};

export type UpdateBudgetInput = Partial<Pick<Budget, "limitAmount">> & {
  id: string;
};

// ---------------------------------------------------------------------------
// Budget with computed spending data (derived — never stored in DB)
// ---------------------------------------------------------------------------
export type BudgetWithSpending = Budget & {
  /** Sum of all expenses for this user/year/month/category. */
  spent: number;
  /** limitAmount - spent (can be negative if over budget). */
  remaining: number;
  /** spent / limitAmount * 100, clamped to [0, 100] for UI progress bar. */
  progressPercent: number;
  /** Category display name, resolved from DEFAULT_CATEGORIES. */
  categoryName: string;
};

// ---------------------------------------------------------------------------
// Validation result — mirrors ValidationResult in entities/Expense.ts
// ---------------------------------------------------------------------------
export type BudgetValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };
