/**
 * src/lib/alertCalculation.ts
 *
 * Pure, deterministic TypeScript functions for generating spending alerts.
 * No Supabase, no React, no side-effects — safe to call from anywhere,
 * including test suites.
 *
 * Design rules:
 *  - Alerts fire at exactly 80% (warning) and ≥100% (critical/over).
 *  - Percentages are calculated as: (spent / limit) * 100 — no rounding before comparison.
 *  - "over" threshold is a sub-type of "critical" used when spent > limit.
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

/**
 * Determines which alert threshold level applies to the given spending data.
 *
 * Returns:
 *  - "over"     when spentPercent > 100
 *  - "critical" when spentPercent === 100 (exactly at limit)
 *  - "warning"  when spentPercent >= 80 and < 100
 *  - null       when spentPercent < 80 (no alert)
 */
export function computeThreshold(
  spentAmount: number,
  limitAmount: number,
): AlertThreshold | null {
  if (limitAmount <= 0) return null; // No valid budget → no alert

  const percent = (spentAmount / limitAmount) * 100;

  if (percent > 100) return "over";
  if (percent >= ALERT_THRESHOLDS.critical) return "critical";
  if (percent >= ALERT_THRESHOLDS.warning) return "warning";
  return null;
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
 *  - When a threshold increases (e.g., warning → over) a new alert fires for
 *    the higher level; the old level alert is not automatically removed
 *    (it may already be read/dismissed by the user).
 *  - Alerts for budgets below 80% are not generated.
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
// Alert display helpers
// ---------------------------------------------------------------------------

/**
 * Returns a human-readable title for an alert.
 */
export function getAlertTitle(alert: Pick<SpendingAlert, "threshold" | "categoryName">): string {
  switch (alert.threshold) {
    case "over":
      return `${alert.categoryName} — Over budget!`;
    case "critical":
      return `${alert.categoryName} — Budget reached`;
    case "warning":
      return `${alert.categoryName} — Approaching limit`;
  }
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

  switch (alert.threshold) {
    case "over":
      return `You have spent ${spent} — ${pct}% of your ${limit} budget.`;
    case "critical":
      return `You have reached your ${limit} budget limit (${pct}% used).`;
    case "warning":
      return `You have spent ${spent} — ${pct}% of your ${limit} budget.`;
  }
}

/**
 * Returns the CSS colour variant for a given threshold.
 * Used to colour-code alert badges and banners.
 */
export function getAlertVariant(
  threshold: AlertThreshold,
): "warning" | "destructive" | "default" {
  switch (threshold) {
    case "over":
      return "destructive";
    case "critical":
      return "destructive";
    case "warning":
      return "warning";
  }
}
