/**
 * src/hooks/alerts/useSpendingAlerts.ts
 *
 * React hook for Feature 5: Automated Spending Alerts.
 *
 * Responsibilities:
 *  1. Accepts the current user's BudgetWithSpending data for a given year/month.
 *  2. Recalculates alerts whenever budgets change (which happens automatically
 *     when useExpenseMutations invalidates the ["budgets", year, month] cache).
 *  3. Merges freshly-generated alerts with existing localStorage state so
 *     read/dismissed flags are not lost when expenses change.
 *  4. Prevents duplicate alerts via the deterministic composite ID.
 *  5. Exposes markAsRead, markAllAsRead, dismiss, and dismissAll actions.
 *
 * Storage: localStorage key = `spending_alerts:${userId}` → JSON array.
 * The key is scoped to the userId so different users on the same browser
 * do not share alert state.
 *
 * NOTE: The Supabase migration 20240004000000_create_spending_alerts.sql has
 * been created for review but NOT applied.  All persistence is currently
 * client-side (localStorage).
 */

"use client";

import { useCallback, useEffect, useMemo } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SpendingAlert } from "@/entities/Alert";
import type { BudgetWithSpending } from "@/entities/Budget";
import { generateAlerts } from "@/lib/alertCalculation";
import { loadStoredAlerts, saveStoredAlerts } from "@/lib/alertStorage";

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const alertQueryKey = (userId: string) =>
  ["spending_alerts", userId] as const;

const NO_ALERTS: SpendingAlert[] = [];

/** Stable selector so React Query memoizes the derived list. */
const selectActive = (alerts: SpendingAlert[]) => alerts.filter((a) => !a.isDismissed);

/**
 * Reactive read of the active (non-dismissed) alerts in the React Query cache.
 *
 * The cache entry is client state: it is only ever written with
 * setQueryData (from localStorage in AlertsProvider's mount effect, from the
 * recalculation effect below, and from the read/dismiss actions).  skipToken
 * means no queryFn ever runs, so an in-flight fetch can never overwrite a
 * newer setQueryData.  The observer re-renders subscribers after each write,
 * via React Query's scheduled notifications rather than during render, and
 * `select` returns the same array reference until the cached data changes.
 */
export function useActiveAlerts(userId: string | null | undefined): SpendingAlert[] {
  const { data } = useQuery({
    queryFn: skipToken,
    queryKey: alertQueryKey(userId ?? ""),
    select: selectActive,
  });
  return userId && data ? data : NO_ALERTS;
}

/** Field-level equality so recalculation only writes when something changed. */
function sameAlerts(a: SpendingAlert[], b: SpendingAlert[]): boolean {
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
// Main hook
// ---------------------------------------------------------------------------

/**
 * Manages spending alerts for the logged-in user.
 *
 * Call this once per page that monitors budgets; pass `budgets` from `useBudgets()`.
 * The `budgets` prop is the `BudgetWithSpending[]` for the target month/year.
 *
 * Usage:
 * ```tsx
 * const { data: budgets } = useBudgets(year, month);
 * const alerts = useSpendingAlerts(userId, year, month, budgets ?? []);
 * ```
 */
export function useSpendingAlerts(
  userId: string | null | undefined,
  year: number,
  month: number,
  budgets: BudgetWithSpending[],
) {
  const queryClient = useQueryClient();

  // ── Recalculate, persist to localStorage and update React Query cache ─────
  // Runs after commit whenever `budgets` changes (useBudgets derives spending
  // from the expenses query, so expense changes flow through here).  Never
  // runs during render, so no other component is updated mid-render.
  useEffect(() => {
    if (!userId) return;

    // Load existing stored alerts (preserves state for other months and the
    // user's read/dismissed flags)
    const existing = loadStoredAlerts(userId);

    const freshAlerts = generateAlerts(
      userId,
      budgets.map((b) => ({
        categoryId: b.categoryId,
        categoryName: b.categoryName,
        limitAmount: b.limitAmount,
        month: b.month ?? month,
        spent: b.spent,
        year: b.year ?? year,
      })),
      existing,
    );

    // Merge: new alerts take priority; existing dismissed state is preserved
    const merged = new Map(existing);
    for (const alert of freshAlerts) {
      merged.set(alert.id, alert);
    }

    // Prune dismissed alerts older than 90 days to keep storage lean
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const pruned = Array.from(merged.values()).filter(
      (a) => !a.isDismissed || new Date(a.createdAt).getTime() > cutoff,
    );

    // Skip no-op writes: setQueryData always notifies observers, so writing an
    // unchanged list would re-render subscribers and re-run this effect.
    const cached = queryClient.getQueryData<SpendingAlert[]>(alertQueryKey(userId));
    if (cached && sameAlerts(cached, pruned)) return;

    saveStoredAlerts(userId, pruned);

    // Update the React Query cache so all components reading this key re-render
    queryClient.setQueryData(alertQueryKey(userId), pruned);
  }, [userId, budgets, year, month, queryClient]);

  // ── Read from React Query cache (reactive) ────────────────────────────────
  // Active = not dismissed
  const activeAlerts = useActiveAlerts(userId);
  const unreadCount = activeAlerts.filter((a) => !a.isRead).length;

  // Alerts for the current month/year (used by the Budgets page banner)
  const currentMonthAlerts = useMemo(
    () => activeAlerts.filter((a) => a.year === year && a.month === month),
    [activeAlerts, year, month],
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const updateAlerts = useCallback(
    (updater: (alerts: SpendingAlert[]) => SpendingAlert[]) => {
      if (!userId) return;
      const current: SpendingAlert[] =
        queryClient.getQueryData(alertQueryKey(userId)) ?? [];
      const updated = updater(current);
      queryClient.setQueryData(alertQueryKey(userId), updated);
      saveStoredAlerts(userId, updated);
    },
    [userId, queryClient],
  );

  const markAsRead = useCallback(
    (alertId: string) => {
      updateAlerts((alerts) =>
        alerts.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)),
      );
    },
    [updateAlerts],
  );

  const markAllAsRead = useCallback(() => {
    updateAlerts((alerts) => alerts.map((a) => ({ ...a, isRead: true })));
  }, [updateAlerts]);

  const dismiss = useCallback(
    (alertId: string) => {
      updateAlerts((alerts) =>
        alerts.map((a) =>
          a.id === alertId ? { ...a, isDismissed: true, isRead: true } : a,
        ),
      );
    },
    [updateAlerts],
  );

  const dismissAll = useCallback(() => {
    updateAlerts((alerts) =>
      alerts.map((a) => ({ ...a, isDismissed: true, isRead: true })),
    );
  }, [updateAlerts]);

  return {
    /** All non-dismissed alerts across all months. */
    alerts: activeAlerts,
    /** Alerts for the current year/month only. */
    currentMonthAlerts,
    /** Count of unread (non-dismissed) alerts. */
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissAll,
  };
}
