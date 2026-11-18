/**
 * src/lib/alertSync.ts
 *
 * The only code that writes spending alerts. No React: every function takes
 * the QueryClient, so hooks call these from effects or event handlers (never
 * during render) and the tests drive them with a real QueryClient.
 *
 * State lives in two places that are always written together:
 *  - the React Query cache under ["spending_alerts", userId] (what the UI reads)
 *  - localStorage under `spending_alerts:<userId>` (survives a reload)
 */

import type { QueryClient } from "@tanstack/react-query";

import type { SpendingAlert } from "@/entities/Alert";
import type { BudgetWithSpending } from "@/entities/Budget";
import { reconcileMonthAlerts, sameAlertLists } from "@/lib/alertCalculation";
import { loadStoredAlerts, saveStoredAlerts } from "@/lib/alertStorage";

/** Query key of the client-only alerts cache entry (never fetched). */
export const alertQueryKey = (userId: string) => ["spending_alerts", userId] as const;

/** Writes the list to the cache and storage, unless nothing changed. */
function writeAlerts(queryClient: QueryClient, userId: string, next: SpendingAlert[]): boolean {
  const cached = queryClient.getQueryData<SpendingAlert[]>(alertQueryKey(userId));
  // setQueryData always notifies observers, so an unchanged list is skipped
  // to avoid re-rendering every alert consumer for nothing.
  if (cached && sameAlertLists(cached, next)) return false;
  saveStoredAlerts(userId, next);
  queryClient.setQueryData(alertQueryKey(userId), next);
  return true;
}

/**
 * Loads the user's stored alerts into the cache (on mount, after a reload, or
 * when another tab changed them).
 */
export function loadAlertsIntoCache(queryClient: QueryClient, userId: string): SpendingAlert[] {
  const stored = Array.from(loadStoredAlerts(userId).values());
  const cached = queryClient.getQueryData<SpendingAlert[]>(alertQueryKey(userId));
  if (!cached || !sameAlertLists(cached, stored)) {
    queryClient.setQueryData(alertQueryKey(userId), stored);
  }
  return stored;
}

/**
 * Re-evaluates one month from its budgets-with-spending and stores the result.
 * Only call it with budgets that loaded successfully: an empty list means
 * "this month has no budgets" and clears that month's alerts.
 *
 * @returns true when the stored alerts changed.
 */
export function syncMonthAlerts(
  queryClient: QueryClient,
  userId: string,
  year: number,
  month: number,
  budgets: ReadonlyArray<Pick<BudgetWithSpending, "categoryId" | "categoryName" | "limitAmount" | "spent" | "year" | "month">>,
  now: number = Date.now(),
): boolean {
  if (!userId) return false;

  // Start from storage, not the cache: it also holds other months' alerts
  // and any change another tab made since this tab last loaded.
  const stored = loadStoredAlerts(userId).values();
  const next = reconcileMonthAlerts(
    userId,
    year,
    month,
    budgets.map((b) => ({
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      limitAmount: b.limitAmount,
      month: b.month ?? month,
      spent: b.spent,
      year: b.year ?? year,
    })),
    stored,
    now,
  );
  return writeAlerts(queryClient, userId, next);
}

/** Applies a read/dismiss change to the user's alerts. */
export function updateAlerts(
  queryClient: QueryClient,
  userId: string,
  updater: (alerts: SpendingAlert[]) => SpendingAlert[],
): void {
  if (!userId) return;
  const current =
    queryClient.getQueryData<SpendingAlert[]>(alertQueryKey(userId)) ??
    Array.from(loadStoredAlerts(userId).values());
  writeAlerts(queryClient, userId, updater(current));
}

export const markAlertRead = (alerts: SpendingAlert[], id: string) =>
  alerts.map((a) => (a.id === id && !a.isRead ? { ...a, isRead: true } : a));

export const markAllAlertsRead = (alerts: SpendingAlert[]) =>
  alerts.map((a) => (a.isRead ? a : { ...a, isRead: true }));

export const dismissAlert = (alerts: SpendingAlert[], id: string) =>
  alerts.map((a) => (a.id === id ? { ...a, isDismissed: true, isRead: true } : a));

/** Dismisses every alert that is currently visible (not yet dismissed). */
export const dismissAllAlerts = (alerts: SpendingAlert[]) =>
  alerts.map((a) => (a.isDismissed ? a : { ...a, isDismissed: true, isRead: true }));

/** Alerts the user has not dismissed. */
export const activeAlerts = (alerts: SpendingAlert[]) => alerts.filter((a) => !a.isDismissed);

/** Number of active alerts the user has not read. */
export const countUnread = (alerts: SpendingAlert[]) =>
  alerts.reduce((n, a) => (!a.isDismissed && !a.isRead ? n + 1 : n), 0);
