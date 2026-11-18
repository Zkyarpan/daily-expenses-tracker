/**
 * src/hooks/alerts/useSpendingAlerts.ts
 *
 * React bindings for Feature 5: Automated Spending Alerts.
 *
 *  - useActiveAlerts: reactive read of the user's non-dismissed alerts.
 *  - useMonthAlertSync: keeps one month's alerts in step with that month's
 *    budgets and spending.
 *
 * AlertsProvider runs useMonthAlertSync for the CURRENT month on every
 * protected page, so the header count is right wherever an expense or budget
 * changes. The Budgets page also runs it for the month it is showing.
 *
 * All writes go through src/lib/alertSync.ts and only ever happen in effects
 * or event handlers, never during render.
 *
 * Storage: localStorage key = `spending_alerts:${userId}` → JSON array; see
 * src/lib/alertStorage.ts. There is no spending_alerts table: alerts are
 * derived from budgets + expenses, which RLS already scopes to the user.
 */

"use client";

import { useEffect } from "react";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SpendingAlert } from "@/entities/Alert";
import type { BudgetWithSpending } from "@/entities/Budget";
import { activeAlerts, alertQueryKey, syncMonthAlerts } from "@/lib/alertSync";

export { alertQueryKey };

const NO_ALERTS: SpendingAlert[] = [];

/**
 * Reactive read of the active (non-dismissed) alerts in the React Query cache.
 *
 * The cache entry is client state: it is only ever written with
 * setQueryData (see src/lib/alertSync.ts).  skipToken means no queryFn ever
 * runs, so an in-flight fetch can never overwrite a newer setQueryData.  The
 * observer re-renders subscribers after each write, via React Query's
 * scheduled notifications rather than during render, and `select` returns
 * the same array reference until the cached data changes.
 */
export function useActiveAlerts(userId: string | null | undefined): SpendingAlert[] {
  const { data } = useQuery({
    queryFn: skipToken,
    queryKey: alertQueryKey(userId ?? ""),
    select: activeAlerts,
  });
  return userId && data ? data : NO_ALERTS;
}

/**
 * Recalculates the alerts for `year`/`month` whenever that month's budgets or
 * spending change (useBudgets derives spending from the expenses query, so
 * expense create/edit/delete flows through `budgets`).
 *
 * @param enabled pass useBudgets' `isSuccess`: while either query is loading
 *   or failed, `budgets` is an empty placeholder and must not clear alerts.
 */
export function useMonthAlertSync(
  userId: string | null | undefined,
  year: number,
  month: number,
  budgets: BudgetWithSpending[],
  enabled: boolean,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !enabled) return;
    syncMonthAlerts(queryClient, userId, year, month, budgets);
  }, [userId, enabled, budgets, year, month, queryClient]);
}
