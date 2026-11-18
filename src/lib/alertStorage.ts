/**
 * src/lib/alertStorage.ts
 *
 * localStorage helpers for spending alert persistence.
 * Pure functions — no React, no Supabase dependencies.
 *
 * Alerts are stored per-user under the key `spending_alerts:<userId>`.
 * Every record read back is validated and must carry the same userId as the
 * key it was read from; anything else (another account's record, a
 * hand-edited or corrupt entry) is ignored, so alerts can never leak between
 * accounts that share a browser.
 */

import type { AlertThreshold, SpendingAlert } from "@/entities/Alert";
import { buildAlertId } from "@/lib/alertCalculation";

const STORAGE_PREFIX = "spending_alerts";

export function alertStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Validates one stored record for `userId`. Returns null for anything that is
 * not a well-formed alert of that user. Records written by older builds with
 * the retired "over" level are converted to "critical" (and re-keyed).
 */
function toStoredAlert(value: unknown, userId: string): SpendingAlert | null {
  if (typeof value !== "object" || value === null) return null;
  const r = value as Record<string, unknown>;

  if (r.userId !== userId) return null;
  if (typeof r.id !== "string" || typeof r.categoryId !== "string") return null;
  if (!Number.isInteger(r.year) || !Number.isInteger(r.month)) return null;
  if ((r.month as number) < 1 || (r.month as number) > 12) return null;
  if (!isFiniteNumber(r.spentAmount) || !isFiniteNumber(r.limitAmount)) return null;
  if (!isFiniteNumber(r.spentPercent)) return null;

  let threshold: AlertThreshold;
  if (r.threshold === "warning" || r.threshold === "critical") threshold = r.threshold;
  else if (r.threshold === "over") threshold = "critical";
  else return null;

  const year = r.year as number;
  const month = r.month as number;

  return {
    categoryId: r.categoryId,
    categoryName: typeof r.categoryName === "string" ? r.categoryName : r.categoryId,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString(),
    id: buildAlertId(userId, year, month, r.categoryId, threshold),
    isDismissed: r.isDismissed === true,
    isRead: r.isRead === true,
    limitAmount: r.limitAmount,
    month,
    spentAmount: r.spentAmount,
    spentPercent: r.spentPercent,
    threshold,
    userId,
    year,
  };
}

/**
 * Parses the raw JSON stored for `userId`. Pure (no window access), so it is
 * unit-testable. Invalid JSON or a non-array yields an empty map; duplicate
 * IDs (e.g. a legacy "over" next to its "critical") keep the first record.
 */
export function parseStoredAlerts(raw: string | null, userId: string): Map<string, SpendingAlert> {
  const result = new Map<string, SpendingAlert>();
  if (!raw || !userId) return result;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return result;
  }
  if (!Array.isArray(parsed)) return result;

  for (const item of parsed) {
    const alert = toStoredAlert(item, userId);
    if (alert && !result.has(alert.id)) result.set(alert.id, alert);
  }
  return result;
}

export function loadStoredAlerts(userId: string): Map<string, SpendingAlert> {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(alertStorageKey(userId))
        : null;
    return parseStoredAlerts(raw, userId);
  } catch {
    return new Map();
  }
}

export function saveStoredAlerts(userId: string, alerts: SpendingAlert[]): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        alertStorageKey(userId),
        // Never persist another account's record under this user's key.
        JSON.stringify(alerts.filter((a) => a.userId === userId)),
      );
    }
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
}
