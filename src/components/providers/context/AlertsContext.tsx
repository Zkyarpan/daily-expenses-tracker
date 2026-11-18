/**
 * src/components/providers/context/AlertsContext.tsx
 *
 * Feature 5: Automated Spending Alerts — React Context
 *
 * Provides one shared alert state across the protected pages so that:
 *  - The header Alerts button shows the correct unread count.
 *  - The Budgets page banner and Dashboard banner share the same alert state.
 *  - Alert read/dismiss actions from one component are visible everywhere.
 *
 * Alerts are recalculated here for the CURRENT calendar month on every
 * protected page (CurrentMonthAlertSync). Before, they were only calculated
 * while the Budgets page was open, so a budget crossed from the Expenses page,
 * the Dashboard or an import produced no alert until the user happened to
 * visit Budgets. The Budgets page additionally syncs the month it shows.
 *
 * Usage:
 *   Wrap your app in <AlertsProvider> (added to the protected layout).
 *   Consume via: const { alerts, unreadCount, markAsRead, ... } = useAlerts();
 */

"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { SpendingAlert } from "@/entities/Alert";
import { useActiveAlerts, useMonthAlertSync } from "@/hooks/alerts/useSpendingAlerts";
import { useBudgets } from "@/hooks/budgets/useBudgets";
import { alertStorageKey } from "@/lib/alertStorage";
import {
  countUnread,
  dismissAlert,
  dismissAllAlerts,
  loadAlertsIntoCache,
  markAlertRead,
  markAllAlertsRead,
  updateAlerts,
} from "@/lib/alertSync";
import { supabase } from "@/lib/supabase";

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
  /**
   * The user whose alerts may be recalculated: the server-verified user id,
   * but only once the browser's Supabase session is confirmed to be the same
   * user. Null in demo mode, while signed out, or during an account switch.
   */
  syncUserId: string | null;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Browser session user id: undefined until known, null when signed out. */
function useSessionUserId(): string | null | undefined {
  const [sessionUserId, setSessionUserId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    // INITIAL_SESSION is read from the auth cookie (no network round-trip);
    // later events cover sign-out and account switches in this or another tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return sessionUserId;
}

/** Calendar year and 1-based month, read when the component renders. */
function currentYearMonth() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/**
 * Headless: recalculates the current month's alerts from its budgets and
 * spending. A separate component so that budgets/expenses query status
 * changes re-render only this, not the provider or its consumers.
 */
function CurrentMonthAlertSync({ userId }: { userId: string }) {
  const { month, year } = currentYearMonth();
  const { data: budgets, isSuccess } = useBudgets(year, month);
  useMonthAlertSync(userId, year, month, budgets, isSuccess);
  return null;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
interface AlertsProviderProps {
  userId: string | null | undefined;
  children: React.ReactNode;
}

export function AlertsProvider({ userId, children }: AlertsProviderProps) {
  const queryClient = useQueryClient();
  const ownerId = userId ?? null;
  const sessionUserId = useSessionUserId();

  // The budgets/expenses query keys are not user-scoped, and the query cache
  // is cleared on an account switch. Recalculating only while the browser
  // session matches the server-verified user means another account's data
  // (or a signed-out empty result) can never be written under this key.
  const syncUserId = ownerId !== null && sessionUserId === ownerId ? ownerId : null;

  // ── Actions ───────────────────────────────────────────────────────────────
  const update = useCallback(
    (updater: (alerts: SpendingAlert[]) => SpendingAlert[]) => {
      if (ownerId) updateAlerts(queryClient, ownerId, updater);
    },
    [ownerId, queryClient],
  );

  const markAsRead = useCallback(
    (id: string) => update((all) => markAlertRead(all, id)),
    [update],
  );
  const markAllAsRead = useCallback(() => update(markAllAlertsRead), [update]);
  const dismiss = useCallback((id: string) => update((all) => dismissAlert(all, id)), [update]);
  const dismissAll = useCallback(() => update(dismissAllAlerts), [update]);

  // ── Load persisted alerts into the query cache (after mount) ──────────────
  // Also reloads when another tab changes this user's alerts, so read and
  // dismissed flags stay consistent across tabs.
  useEffect(() => {
    if (!ownerId) return;
    loadAlertsIntoCache(queryClient, ownerId);

    const key = alertStorageKey(ownerId);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) loadAlertsIntoCache(queryClient, ownerId);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [ownerId, queryClient]);

  // ── Derived values ────────────────────────────────────────────────────────
  // useActiveAlerts observes only the alerts query key, so this provider
  // re-renders when alerts change — not on every QueryCache event.  Its array
  // reference is stable until the cached alerts change.
  const alerts = useActiveAlerts(ownerId);
  const unreadCount = countUnread(alerts);

  const value = useMemo<AlertsContextValue>(
    () => ({ alerts, dismiss, dismissAll, markAllAsRead, markAsRead, syncUserId, unreadCount }),
    [alerts, dismiss, dismissAll, markAllAsRead, markAsRead, syncUserId, unreadCount],
  );

  return (
    <AlertsContext.Provider value={value}>
      {syncUserId && <CurrentMonthAlertSync userId={syncUserId} />}
      {children}
    </AlertsContext.Provider>
  );
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
