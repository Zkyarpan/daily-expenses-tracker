"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { useExpenses } from "@/hooks/expenses/useExpenses";
import { onboardingApi } from "@/lib/api/onboarding";
import { notificationPermission, registerNotificationWorker, showSystemNotification } from "@/lib/notify";
import {
  addSeenSignals,
  readDone,
  readPrefs,
  readSeenSignals,
  readStamp,
  todayKey,
  writeStamp,
} from "@/lib/onboarding/prefs";
import type { InterestId } from "@/lib/onboarding/schemas";
import { spendingSignals } from "@/lib/onboarding/spendingSignals";
import { isReminderDue, pickTip } from "@/lib/onboarding/tips";
import { formatCurrency } from "@/lib/utils";

import { OnboardingWizard, type WizardResult } from "./OnboardingWizard";
import { ProductTour } from "./ProductTour";

interface Engagement {
  /** false in demo mode: setup and the tour need an account. */
  enabled: boolean;
  /** Re-run the first-run questions. */
  openSetup: () => void;
  startTour: () => void;
}

const EngagementContext = createContext<Engagement | null>(null);

const NOOP: Engagement = { enabled: false, openSetup: () => {}, startTour: () => {} };

/** Setup + tour controls; inert outside the signed-in app shell. */
export const useEngagement = () => useContext(EngagementContext) ?? NOOP;

/**
 * In the background, with permission: a system notification (tapping it opens
 * `url`). Returns false when the tab is visible or notifications aren't
 * allowed, so the caller shows an in-app pop-up instead.
 */
function systemNotify(title: string, body: string, url?: string): boolean {
  if (typeof document === "undefined" || document.visibilityState === "visible") return false;
  if (notificationPermission() !== "granted") return false;
  void showSystemNotification(title, { body, tag: title, url });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Live: keep data fresh while the app is open, across tabs, and through outages
// ─────────────────────────────────────────────────────────────────────────────

function useLiveSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const refreshSummaries = () => {
      for (const key of [["money"], ["profile", "stats"], ["plan"]]) void queryClient.invalidateQueries({ queryKey: key });
    };

    const onOffline = () =>
      toast.warning("You’re offline", {
        description: "You can keep browsing; changes will save once you’re back online.",
        duration: Infinity,
        id: "network",
      });
    const onOnline = () => {
      toast.success("Back online", { description: "Everything is up to date.", duration: 4000, id: "network" });
      void queryClient.invalidateQueries();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    if (!navigator.onLine) onOffline();

    // Refresh summaries every 2 minutes while the tab is visible, and on return.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) refreshSummaries();
    }, 120_000);
    const onVisible = () => document.visibilityState === "visible" && refreshSummaries();
    document.addEventListener("visibilitychange", onVisible);

    // Changes made in one tab show up in your other open tabs.
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("daily-expenses-sync") : null;
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.mutation.state.status === "success") channel?.postMessage("changed");
    });
    if (channel) channel.onmessage = () => void queryClient.invalidateQueries();

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
      channel?.close();
    };
  }, [queryClient]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Nudges: one feature tip a day, the daily reminder, and budget alerts
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFIED_KEY = "alerts-notified";

function useNudges({ active, interests }: { active: boolean; interests: InterestId[] }) {
  const router = useRouter();
  const { openExpense, openIou, openReceiptScan, openWishlist } = useQuickAdd();
  const { alerts } = useAlerts();

  // Daily tip, ~20 s after opening the app.
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const prefs = readPrefs();
      const today = todayKey();
      if (!prefs.tips || document.visibilityState !== "visible" || !navigator.onLine || readStamp("lastTip") === today) return;
      const tip = pickTip({ dateKey: today, done: readDone(), interests });
      if (!tip) return;
      writeStamp("lastTip", today);
      toast.info(tip.title, {
        action: {
          label: tip.action.label,
          onClick: () => {
            if (tip.action.href) router.push(tip.action.href);
            else if (tip.action.quickAdd === "receipt") openReceiptScan();
            else if (tip.action.quickAdd === "iou") openIou();
            else if (tip.action.quickAdd === "wishlist") openWishlist();
          },
        },
        description: tip.description,
        duration: 12_000,
      });
    }, 20_000);
    return () => clearTimeout(timer);
  }, [active, interests, openIou, openReceiptScan, openWishlist, router]);

  // Daily check-in: the app asks one quick question (~45 s in, once a day).
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const now = new Date();
      const today = todayKey(now);
      if (!readPrefs().tips || document.visibilityState !== "visible" || readStamp("checkIn") === today) return;
      writeStamp("checkIn", today);

      const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
      const questions = [
        {
          body: "Logging it now takes a few seconds.",
          no: { label: "Not today", run: () => toast.success("Nice — a no-spend day!", { description: "Days like this add up." }) },
          title: "Quick question: did you spend anything today?",
          yes: { label: "Yes, add it", run: () => openExpense() },
        },
        {
          body: "Mark it as paid so your totals stay right.",
          no: { label: "No", run: () => {} },
          title: "Has anyone paid you back lately?",
          yes: { label: "Yes, update it", run: () => router.push("/lend-borrow") },
        },
        {
          body: "Your categories, trends and month-on-month change.",
          no: { label: "Later", run: () => {} },
          title: "Want to see where your money went this month?",
          yes: { label: "Show me", run: () => router.push("/analytics") },
        },
        {
          body: "Snap it and the details fill themselves in.",
          no: { label: "No", run: () => {} },
          title: "Got a receipt from today?",
          yes: { label: "Scan it", run: () => openReceiptScan() },
        },
      ];
      // Evenings always ask about today's spending; other times rotate by day.
      const q = now.getHours() >= 17 ? questions[0] : questions[dayOfYear % questions.length];
      toast(q.title, {
        action: { label: q.yes.label, onClick: q.yes.run },
        cancel: { label: q.no.label, onClick: q.no.run },
        description: q.body,
        duration: 20_000,
        id: "check-in",
      });
    }, 45_000);
    return () => clearTimeout(timer);
  }, [active, openExpense, openReceiptScan, router]);

  // Daily reminder, checked every minute while the app is open.
  useEffect(() => {
    if (!active) return;
    const check = () => {
      const prefs = readPrefs();
      const now = new Date();
      if (!prefs.dailyReminder || !isReminderDue({ lastShown: readStamp("lastReminder"), now, time: prefs.reminderTime })) return;
      writeStamp("lastReminder", todayKey(now));
      const title = "Time to log today’s spending";
      const body = "It takes 30 seconds — add anything you spent today.";
      if (!systemNotify(title, body, "/expenses")) {
        toast.info(title, {
          action: { label: "Add expense", onClick: () => openExpense() },
          description: body,
          duration: 15_000,
        });
      }
    };
    const first = setTimeout(check, 5_000);
    const timer = setInterval(check, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [active, openExpense]);

  // New budget alerts → a pop-up (or a system notification in the background).
  useEffect(() => {
    if (!active || alerts.length === 0) return;
    let notified: string[] = [];
    try {
      notified = JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "[]");
    } catch {
      notified = [];
    }
    const fresh = alerts.filter((a) => !a.isRead && !a.isDismissed && !notified.includes(a.id));
    if (fresh.length === 0) return;
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified, ...fresh.map((a) => a.id)].slice(-200)));

    // Several budgets crossing a line together → one summary, not a pile of pop-ups.
    const anyOver = fresh.some((a) => a.spentPercent > 100);
    let title: string;
    let body: string;
    if (fresh.length === 1) {
      const [alert] = fresh;
      title = anyOver ? `${alert.categoryName} is over budget` : `${alert.categoryName} is at ${Math.round(alert.spentPercent)}% of its budget`;
      body = `${formatCurrency(alert.spentAmount)} of ${formatCurrency(alert.limitAmount)} spent this month.`;
    } else {
      const names = fresh.map((a) => a.categoryName);
      const listed = names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
      title = `${fresh.length} budgets need attention`;
      body = `${listed} are close to or over their limit.`;
    }
    const openBudgets = () => router.push("/budgets");
    if (!systemNotify(title, body, "/budgets")) {
      (anyOver ? toast.error : toast.warning)(title, {
        action: { label: "View budgets", onClick: openBudgets },
        description: body,
        duration: 10_000,
        // A later batch replaces this one rather than stacking under it.
        id: "budget-alerts",
      });
    }
  }, [active, alerts, router]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Spending alerts: "something happened" pop-ups worked out from your expenses
// ─────────────────────────────────────────────────────────────────────────────

/** Gap between two spending pop-ups, so they never pile up. */
const SIGNAL_GAP_MS = 3 * 60_000;

function useSpendingWatch({ active }: { active: boolean }) {
  const router = useRouter();
  // The calendar month when the app was opened; a new month is picked up on reload.
  const [today] = useState(() => new Date());
  const year = today.getFullYear();
  const month0 = today.getMonth();
  const thisMonth = useExpenses(year, month0);
  const lastMonth = useExpenses(month0 === 0 ? year - 1 : year, month0 === 0 ? 11 : month0 - 1);
  const lastShown = useRef(0);

  const ready = thisMonth.isSuccess && lastMonth.isSuccess;
  const signals = useMemo(
    () =>
      ready
        ? spendingSignals({
            format: (amount) => formatCurrency(amount),
            lastMonth: lastMonth.data ?? [],
            thisMonth: thisMonth.data ?? [],
            today: new Date(),
          })
        : [],
    [ready, thisMonth.data, lastMonth.data],
  );

  useEffect(() => {
    if (!active || signals.length === 0) return;
    // A few seconds after the data settles, so it doesn't land on top of page load.
    const wait = Math.max(6_000, lastShown.current + SIGNAL_GAP_MS - Date.now());
    const timer = setTimeout(() => {
      if (!readPrefs().spendingAlerts || !navigator.onLine) return;
      const seen = new Set(readSeenSignals());
      const fresh = signals.filter((s) => !seen.has(s.id));
      if (fresh.length === 0) return;
      // One pop-up at a time; the rest are skipped for now (they're older news).
      const [signal] = fresh;
      addSeenSignals(fresh.map((s) => s.id));
      lastShown.current = Date.now();
      const go = () => router.push(signal.href);
      if (systemNotify(signal.title, signal.body, signal.href)) return;
      const show = signal.tone === "success" ? toast.success : signal.tone === "warning" ? toast.warning : toast.info;
      show(signal.title, {
        action: { label: signal.actionLabel, onClick: go },
        description: signal.body,
        duration: 12_000,
        id: "spending-signal",
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [active, router, signals]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function EngagementProvider({
  children,
  enabled,
  initial,
  interests,
  needsSetup,
}: {
  children: React.ReactNode;
  /** false in demo mode (no account). */
  enabled: boolean;
  initial: { income: number | null; name: string };
  interests: InterestId[];
  needsSetup: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [setupOpen, setSetupOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // First visit: ask the questions before anything else.
  useEffect(() => {
    if (!enabled || !needsSetup) return;
    const t = setTimeout(() => setSetupOpen(true), 400);
    return () => clearTimeout(t);
  }, [enabled, needsSetup]);

  useLiveSync();
  // Notifications already allowed: make sure the notification worker is ready.
  useEffect(() => {
    if (enabled && notificationPermission() === "granted") void registerNotificationWorker();
  }, [enabled]);
  useNudges({ active: enabled && !setupOpen && !tourOpen, interests });
  useSpendingWatch({ active: enabled && !setupOpen && !tourOpen });

  const startTour = useCallback(() => setTourOpen(true), []);
  const openSetup = useCallback(() => setSetupOpen(true), []);

  // New users get the full app tour straight after setup — whether they
  // finished it or chose "Set up later". Every tour step has "Skip tour".
  const finish = async ({ name, tour }: WizardResult) => {
    setSetupOpen(false);
    // The tour opens with its own welcome, so only toast when there is no tour.
    if (!tour) toast.success(`Welcome aboard, ${name}!`, { description: "Your account is set up around you." });
    await queryClient.invalidateQueries();
    router.refresh();
    if (tour) setTimeout(() => setTourOpen(true), 600);
  };

  const skip = async () => {
    setSetupOpen(false);
    setTimeout(() => setTourOpen(true), 400);
    try {
      await onboardingApi.skip();
    } catch {
      // Not critical: the questions will simply be offered again next time.
    }
    router.refresh();
  };

  const value = useMemo(() => ({ enabled, openSetup, startTour }), [enabled, openSetup, startTour]);

  return (
    <EngagementContext.Provider value={value}>
      {children}
      {enabled && (
        <>
          <OnboardingWizard open={setupOpen} initial={initial} onFinish={finish} onSkip={skip} />
          <ProductTour open={tourOpen} onClose={() => setTourOpen(false)} />
        </>
      )}
    </EngagementContext.Provider>
  );
}
