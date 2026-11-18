/**
 * src/lib/alertCalculation.ts
 *
 * Pure, deterministic TypeScript functions for generating spending alerts.
 * No Supabase, no React, no side-effects — safe to call from anywhere,
 * including test suites.
 *
 * Design rules:
 *  - Below 80 % → no alert; 80 %–99.99 % → "warning"; ≥ 100 % → "critical".
 *  - Thresholds are compared in whole pence, so floating-point noise in a
 *    summed total (e.g. 399.99999999999994 for £400.00) cannot move a budget
 *    across a boundary. Displayed percentages are still (spent / limit) * 100.
 *  - Over-budget (spent > limit) is a display detail of "critical", not a
 *    separate level, so one category never has two alerts for one month.
 *  - An alert ID is a deterministic composite key; the same combination of
 *    (userId, year, month, categoryId, threshold) always produces the same ID.
 *  - Month boundaries are enforced by only examining expenses within the target
 *    year/month — the same filter as calculateCategorySpending in budgetValidation.ts.
 */

import type { AlertInput, AlertThreshold, SpendingAlert } from "@/entities/Alert";
import { ALERT_THRESHOLDS } from "@/entities/Alert";

// ---------------------------------------------------------------------------
// Core threshold computation
// ---------------------------------------------------------------------------

/** Rounds a currency amount to whole pence. */
const toPence = (amount: number) => Math.round(amount * 100);

/**
 * Determines which alert threshold level applies to the given spending data.
 *
 * Returns:
 *  - "critical" when spending is 100 % of the limit or more
 *  - "warning"  when spending is at least 80 % and below 100 %
 *  - null       below 80 %, or when there is no valid (> 0) limit
 */
export function computeThreshold(
  spentAmount: number,
  limitAmount: number,
): AlertThreshold | null {
  if (!Number.isFinite(spentAmount) || !Number.isFinite(limitAmount)) return null;

  const limitPence = toPence(limitAmount);
  if (limitPence <= 0) return null; // No valid budget → no alert
  const spentPence = toPence(spentAmount);

  // spent / limit >= pct / 100, kept in integers to avoid rounding drift
  if (spentPence * 100 >= limitPence * ALERT_THRESHOLDS.critical) return "critical";
  if (spentPence * 100 >= limitPence * ALERT_THRESHOLDS.warning) return "warning";
  return null;
}

/** True when spending is strictly above the limit (compared in pence). */
export function isOverBudget(
  alert: Pick<SpendingAlert, "spentAmount" | "limitAmount">,
): boolean {
  return toPence(alert.spentAmount) > toPence(alert.limitAmount);
}

/**
 * Calculates the exact spending percentage (not clamped to 100).
 * Used for display in alert messages.
 */
export function computeSpentPercent(
  spentAmount: number,
  limitAmount: number,
): number {
  if (limitAmount <= 0) return 0;
  return (spentAmount / limitAmount) * 100;
}

// ---------------------------------------------------------------------------
// Alert ID generation (deterministic, deduplication key)
// ---------------------------------------------------------------------------

/**
 * Generates a stable composite ID for an alert.
 * The same (userId, year, month, categoryId, threshold) always → same ID.
 * This is the primary deduplication key — no two alerts with the same ID
 * can coexist.
 */
export function buildAlertId(
  userId: string,
  year: number,
  month: number,
  categoryId: string,
  threshold: AlertThreshold,
): string {
  return `${userId}:${year}:${month}:${categoryId}:${threshold}`;
}

// ---------------------------------------------------------------------------
// Alert generation from a single budget
// ---------------------------------------------------------------------------

/**
 * Generates a SpendingAlert from a single budget's spending data, OR returns
 * null if spending has not crossed any threshold.
 *
 * The returned alert is "new" — isRead and isDismissed are false.
 * The caller is responsible for merging with any existing alert state
 * (e.g., preserving isRead=true from localStorage).
 */
export function generateAlertFromBudget(input: AlertInput): SpendingAlert | null {
  const threshold = computeThreshold(input.spentAmount, input.limitAmount);
  if (threshold === null) return null;

  const spentPercent = computeSpentPercent(input.spentAmount, input.limitAmount);
  const id = buildAlertId(
    input.userId,
    input.year,
    input.month,
    input.categoryId,
    threshold,
  );

  return {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    createdAt: new Date().toISOString(),
    id,
    isDismissed: false,
    isRead: false,
    limitAmount: input.limitAmount,
    month: input.month,
    spentAmount: input.spentAmount,
    spentPercent,
    threshold,
    userId: input.userId,
    year: input.year,
  };
}

// ---------------------------------------------------------------------------
// Bulk generation from a BudgetWithSpending array
// ---------------------------------------------------------------------------

export type BudgetLike = {
  categoryId: string;
  categoryName: string;
  limitAmount: number;
  spent: number;
  year: number;
  month: number;
};

/**
 * Generates alerts for all budgets that have crossed a threshold.
 *
 * Rules:
 *  - One alert per (userId, year, month, categoryId, threshold) combination.
 *  - Alerts for budgets below 80% are not generated.
 *  - Removing alerts that no longer apply (e.g. the old "warning" once a
 *    category reaches "critical") is reconcileMonthAlerts' job.
 *
 * The `existingAlerts` map is keyed by alert ID.  When an alert already exists
 * (same composite key) the existing read/dismissed state is preserved.
 */
export function generateAlerts(
  userId: string,
  budgets: BudgetLike[],
  existingAlerts: Map<string, SpendingAlert>,
): SpendingAlert[] {
  const result: SpendingAlert[] = [];

  for (const budget of budgets) {
    const newAlert = generateAlertFromBudget({
      categoryId: budget.categoryId,
      categoryName: budget.categoryName,
      limitAmount: budget.limitAmount,
      month: budget.month,
      spentAmount: budget.spent,
      userId,
      year: budget.year,
    });

    if (newAlert === null) continue;

    // Preserve existing read/dismissed state if this alert was already generated
    const existing = existingAlerts.get(newAlert.id);
    if (existing) {
      result.push({
        ...newAlert,
        // Preserve user interaction state
        createdAt: existing.createdAt, // Keep original creation time
        isDismissed: existing.isDismissed,
        isRead: existing.isRead,
      });
    } else {
      result.push(newAlert);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reconciling one month against stored alerts
// ---------------------------------------------------------------------------

/**
 * Alerts are kept (and generated) only for budget months up to this many
 * months before the current one. Retention is by budget month, not by
 * createdAt: pruning a dismissed alert by age while its month could still be
 * re-evaluated would bring it back as a new, unread alert.
 */
export const ALERT_RETENTION_MONTHS = 12;

const monthIndex = (year: number, month: number) => year * 12 + (month - 1);

/** True when alerts for `year`/`month` are inside the retention window. */
export function isAlertMonthRetained(year: number, month: number, now: number = Date.now()): boolean {
  const today = new Date(now);
  const current = monthIndex(today.getFullYear(), today.getMonth() + 1);
  return monthIndex(year, month) >= current - ALERT_RETENTION_MONTHS;
}

const SEVERITY: Record<AlertThreshold, number> = { critical: 0, warning: 1 };

/** Newest month first, then critical before warning, then by category name. */
function compareAlerts(a: SpendingAlert, b: SpendingAlert): number {
  return (
    b.year - a.year ||
    b.month - a.month ||
    SEVERITY[a.threshold] - SEVERITY[b.threshold] ||
    a.categoryName.localeCompare(b.categoryName) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Returns the user's complete alert list after re-evaluating ONE month.
 *
 * `budgets` must be the full, successfully loaded budget list (with spending)
 * for `year`/`month`. For that month the result contains exactly the alerts
 * the budgets justify now — at most one per category:
 *  - an alert whose ID is unchanged keeps its read/dismissed state and
 *    createdAt, so recalculating never resurrects a dismissed alert;
 *  - alerts that no longer apply are removed: spending fell below 80 %, the
 *    level changed (warning ↔ critical, which yields a new unread alert), or
 *    the budget was deleted.
 * Alerts for other months are kept as they are. Records that belong to a
 * different user are dropped, so one account's alerts can never be carried
 * into another account's list. Months outside the retention window are
 * dropped and never generated (see ALERT_RETENTION_MONTHS).
 */
export function reconcileMonthAlerts(
  userId: string,
  year: number,
  month: number,
  budgets: BudgetLike[],
  stored: Iterable<SpendingAlert>,
  now: number = Date.now(),
): SpendingAlert[] {
  const sameMonth = new Map<string, SpendingAlert>();
  const otherMonths: SpendingAlert[] = [];

  for (const alert of stored) {
    if (alert.userId !== userId) continue;
    if (!isAlertMonthRetained(alert.year, alert.month, now)) continue;
    if (alert.year === year && alert.month === month) sameMonth.set(alert.id, alert);
    else otherMonths.push(alert);
  }

  if (!isAlertMonthRetained(year, month, now)) return otherMonths.sort(compareAlerts);

  const monthBudgets = budgets.filter((b) => b.year === year && b.month === month);
  const fresh = generateAlerts(userId, monthBudgets, sameMonth);

  // One alert per category for this month, even if the input repeats one.
  const seenCategories = new Set<string>();
  const freshUnique = fresh.filter((a) => {
    if (seenCategories.has(a.categoryId)) return false;
    seenCategories.add(a.categoryId);
    return true;
  });

  return [...otherMonths, ...freshUnique].sort(compareAlerts);
}

/** Field-level equality, used to skip writes that would change nothing. */
export function sameAlertLists(a: readonly SpendingAlert[], b: readonly SpendingAlert[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return (
      x.id === y.id &&
      x.isRead === y.isRead &&
      x.isDismissed === y.isDismissed &&
      x.spentAmount === y.spentAmount &&
      x.spentPercent === y.spentPercent &&
      x.limitAmount === y.limitAmount &&
      x.categoryName === y.categoryName &&
      x.createdAt === y.createdAt
    );
  });
}

// ---------------------------------------------------------------------------
// Alert display helpers
// ---------------------------------------------------------------------------

type AlertAmounts = Partial<Pick<SpendingAlert, "spentAmount" | "limitAmount">>;

const isOver = (alert: AlertAmounts) =>
  alert.spentAmount !== undefined &&
  alert.limitAmount !== undefined &&
  isOverBudget({ limitAmount: alert.limitAmount, spentAmount: alert.spentAmount });

/** Short status label: "Approaching limit", "Budget reached" or "Over budget". */
export function getAlertStatusLabel(
  alert: Pick<SpendingAlert, "threshold"> & AlertAmounts,
): string {
  if (alert.threshold === "warning") return "Approaching limit";
  return isOver(alert) ? "Over budget" : "Budget reached";
}

/**
 * Returns a human-readable title for an alert.
 */
export function getAlertTitle(
  alert: Pick<SpendingAlert, "threshold" | "categoryName"> & AlertAmounts,
): string {
  return `${alert.categoryName} — ${getAlertStatusLabel(alert)}`;
}

/**
 * Returns a human-readable description for an alert.
 */
export function getAlertDescription(
  alert: Pick<SpendingAlert, "threshold" | "spentPercent" | "spentAmount" | "limitAmount">,
  formatCurrency: (n: number) => string,
): string {
  const pct = Math.round(alert.spentPercent);
  const spent = formatCurrency(alert.spentAmount);
  const limit = formatCurrency(alert.limitAmount);

  if (alert.threshold === "critical" && !isOverBudget(alert)) {
    return `You have reached your ${limit} budget limit (${pct}% used).`;
  }
  return `You have spent ${spent} — ${pct}% of your ${limit} budget.`;
}

/**
 * Returns the CSS colour variant for a given threshold.
 * Used to colour-code alert badges and banners.
 */
export function getAlertVariant(
  threshold: AlertThreshold,
): "warning" | "destructive" | "default" {
  return threshold === "critical" ? "destructive" : "warning";
}
