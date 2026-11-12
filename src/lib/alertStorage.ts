/**
 * src/lib/alertStorage.ts
 *
 * localStorage helpers for spending alert persistence.
 * Pure functions — no React, no Supabase dependencies.
 *
 * Alerts are stored per-user under the key `spending_alerts:<userId>`.
 */

import type { SpendingAlert } from "@/entities/Alert";

const STORAGE_PREFIX = "spending_alerts";

export function alertStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${userId}`;
}

export function loadStoredAlerts(userId: string): Map<string, SpendingAlert> {
  try {
    const raw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(alertStorageKey(userId))
        : null;
    if (!raw) return new Map();
    const parsed: SpendingAlert[] = JSON.parse(raw);
    return new Map(parsed.map((a) => [a.id, a]));
  } catch {
    return new Map();
  }
}

export function saveStoredAlerts(userId: string, alerts: SpendingAlert[]): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        alertStorageKey(userId),
        JSON.stringify(alerts),
      );
    }
  } catch {
    // localStorage may be unavailable (private mode, quota exceeded, etc.)
  }
}
