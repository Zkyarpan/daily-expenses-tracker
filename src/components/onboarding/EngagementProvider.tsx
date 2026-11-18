"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useQuickAdd } from "@/components/money/QuickAddProvider";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { onboardingApi } from "@/lib/api/onboarding";
import { readDone, readPrefs, readStamp, todayKey, writeStamp } from "@/lib/onboarding/prefs";
import type { InterestId } from "@/lib/onboarding/schemas";
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

/** System notification when the tab is in the background and permission was given; otherwise null. */
function systemNotify(title: string, body: string, onClick?: () => void): boolean {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || document.visibilityState === "visible") {
    return false;
  }
  try {
    const n = new Notification(title, { body, icon: "/icon.svg", tag: title });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
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
      if (!systemNotify(title, body, openExpense)) {
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
    for (const alert of fresh.slice(0, 3)) {
      const over = alert.spentPercent > 100;
      const title = over ? `${alert.categoryName} is over budget` : `${alert.categoryName} is at ${Math.round(alert.spentPercent)}% of its budget`;
      const body = `${formatCurrency(alert.spentAmount)} of ${formatCurrency(alert.limitAmount)} spent this month.`;
      if (!systemNotify(title, body, () => router.push("/budgets"))) {
        (over ? toast.error : toast.warning)(title, {
          action: { label: "View budgets", onClick: () => router.push("/budgets") },
          description: body,
          duration: 10_000,
        });
      }
    }
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified, ...fresh.map((a) => a.id)].slice(-200)));
  }, [active, alerts, router]);
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
  useNudges({ active: enabled && !setupOpen && !tourOpen, interests });

  const startTour = useCallback(() => setTourOpen(true), []);
  const openSetup = useCallback(() => setSetupOpen(true), []);

  const finish = async ({ name, tour }: WizardResult) => {
    setSetupOpen(false);
    toast.success(`Welcome aboard, ${name}!`, { description: "Your account is set up around you." });
    await queryClient.invalidateQueries();
    router.refresh();
    if (tour) setTimeout(() => setTourOpen(true), 600);
  };

  const skip = async () => {
    setSetupOpen(false);
    try {
      await onboardingApi.skip();
    } catch {
      // Not critical: the questions will simply be offered again next time.
    }
    toast.info("No problem", { description: "You can run setup or take the tour any time from your account menu." });
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
