/**
 * src/entities/Alert.ts
 *
 * Type definitions for Feature 5: Automated Spending Alerts.
 *
 * Alerts are derived from BudgetWithSpending data — they are NOT stored in the
 * database during the initial implementation.  They are computed client-side,
 * persisted in localStorage per user, and deduplicated by a composite key:
 *   `${userId}:${year}:${month}:${categoryId}:${threshold}`
 *
 * A Supabase migration SQL is provided (but not executed) for cloud persistence
 * once this approach is reviewed.
 */

// ---------------------------------------------------------------------------
// Threshold levels
// ---------------------------------------------------------------------------

/**
 * The two threshold levels that trigger an alert:
 *   below 80 %       → normal (no alert)
 *   80 % – 99.99 %   → "warning"
 *   100 % or more    → "critical" (includes over-budget; see isOverBudget())
 *
 * Earlier builds also stored a separate "over" level for > 100 %. That gave
 * two alerts for one category (one at exactly 100 %, another just above) and
 * is folded into "critical"; alertStorage converts stored "over" records.
 */
export type AlertThreshold = "warning" | "critical";

/** Percentage trigger points — deterministic, never AI-derived. */
export const ALERT_THRESHOLDS = {
  /** Critical fires when spending >= 100% of the budget limit. */
  critical: 100,
  /** Warning fires when spending >= 80% of the budget limit. */
  warning: 80,
} as const;

// ---------------------------------------------------------------------------
// Alert record
// ---------------------------------------------------------------------------

export type SpendingAlert = {
  /** Stable composite key used for deduplication and localStorage storage. */
  id: string; // `${userId}:${year}:${month}:${categoryId}:${threshold}`

  /** Owning user UUID (matches auth.users.id). */
  userId: string;

  /** Calendar year the budget applies to. */
  year: number;

  /** 1-based month number: 1 = January … 12 = December. */
  month: number;

  /** Text category ID (matches expenses.categoryId and budgets.categoryId). */
  categoryId: string;

  /** Human-readable category name (resolved from DEFAULT_CATEGORIES). */
  categoryName: string;

  /** Which threshold fired this alert. */
  threshold: AlertThreshold;

  /** Amount spent at the time the alert was generated. */
  spentAmount: number;

  /** The budget limit that was set. */
  limitAmount: number;

  /**
   * Actual spending percentage (may exceed 100 when over-budget).
   * Stored as a plain number, e.g. 85.3 for 85.3%.
   */
  spentPercent: number;

  /** Whether the user has read / acknowledged this alert. */
  isRead: boolean;

  /** Whether the user has dismissed this alert. */
  isDismissed: boolean;

  /** ISO timestamp when the alert was first generated. */
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Alert generation input
// ---------------------------------------------------------------------------

export type AlertInput = {
  userId: string;
  year: number;
  month: number;
  categoryId: string;
  categoryName: string;
  limitAmount: number;
  spentAmount: number;
};
