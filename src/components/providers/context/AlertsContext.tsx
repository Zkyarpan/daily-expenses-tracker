/**
 * src/components/providers/context/AlertsContext.tsx
 *
 * Feature 5: Automated Spending Alerts — React Context
 *
 * Provides a single shared instance of useSpendingAlerts across the entire app
 * so that:
 *  - The Navbar bell button shows the correct unread count.
 *  - The Budgets page banner and Dashboard banner share the same alert state.
 *  - Alert read/dismiss actions from one component are visible everywhere.
 *
 * Usage:
 *   Wrap your app in <AlertsProvider> (added to the protected layout).
 *   Consume via: const { alerts, unreadCount, markAsRead, ... } = useAlerts();
 *
 * Design: the context tracks the "current month" alerts based on the current
 * calendar month.  Pages that need alerts for a different month (e.g., the
 * Budgets page when browsing a past month) call useSpendingAlerts directly
 * with their own year/month.
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SpendingAlert } from "@/entities/Alert";
import { alertQueryKey, useActiveAlerts } from "@/hooks/alerts/useSpendingAlerts";
import { loadStoredAlerts, saveStoredAlerts } from "@/lib/alertStorage";

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------
interface AlertsContextValue {
  /** All active (non-dismissed) alerts for the current user. */
  alerts: SpendingAlert[];
  /** Count of unread, non-dismissed alerts. */
  unreadCount: number;
  /** Mark a single alert as read. */
  markAsRead: (id: string) => void;
  /** Mark all alerts as read. */
  markAllAsRead: () => void;
  /** Dismiss a single alert. */
  dismiss: (id: string) => void;
  /** Dismiss all active alerts. */
  dismissAll: () => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
interface AlertsProviderProps {
  userId: string | null | undefined;
  children: React.ReactNode;
}

export function AlertsProvider({ userId, children }: AlertsProviderProps) {
  const queryClient = useQueryClient();

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateAlerts = useCallback(
    (updater: (alerts: SpendingAlert[]) => SpendingAlert[]) => {
      if (!userId) return;
      const key = alertQueryKey(userId);
      const current: SpendingAlert[] = queryClient.getQueryData(key) ?? [];
      const updated = updater(current);
      queryClient.setQueryData(key, updated);
      saveStoredAlerts(userId, updated);
    },
    [userId, queryClient],
  );

  const markAsRead = useCallback(
    (id: string) =>
      updateAlerts((as) => as.map((a) => (a.id === id ? { ...a, isRead: true } : a))),
    [updateAlerts],
  );

  const markAllAsRead = useCallback(
    () => updateAlerts((as) => as.map((a) => ({ ...a, isRead: true }))),
    [updateAlerts],
  );

  const dismiss = useCallback(
    (id: string) =>
      updateAlerts((as) =>
        as.map((a) => (a.id === id ? { ...a, isDismissed: true, isRead: true } : a)),
      ),
    [updateAlerts],
  );

  const dismissAll = useCallback(
    () => updateAlerts((as) => as.map((a) => ({ ...a, isDismissed: true, isRead: true }))),
    [updateAlerts],
  );

  // ── Load persisted alerts into the query cache (after mount) ──────────────
  useEffect(() => {
    if (!userId) return;
    const stored = Array.from(loadStoredAlerts(userId).values());
    if (stored.length > 0) {
      queryClient.setQueryData(alertQueryKey(userId), stored);
    }
  }, [userId, queryClient]);

  // ── Derived values ────────────────────────────────────────────────────────
  // useActiveAlerts observes only the alerts query key, so this provider
  // re-renders when alerts change — not on every QueryCache event (the old
  // global cache subscription called setState while other components were
  // rendering their own useQuery hooks).  Its array reference is stable
  // until the cached alerts change.
  const alerts = useActiveAlerts(userId);

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const value = useMemo<AlertsContextValue>(
    () => ({ alerts, dismiss, dismissAll, markAllAsRead, markAsRead, unreadCount }),
    [alerts, dismiss, dismissAll, markAllAsRead, markAsRead, unreadCount],
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------
export function useAlerts(): AlertsContextValue {
  const ctx = useContext(AlertsContext);
  if (!ctx) {
    throw new Error("useAlerts must be used within an <AlertsProvider>");
  }
  return ctx;
}
