"use client";

import { useState, useSyncExternalStore } from "react";
import { Bell, BellRing, Compass, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/components/onboarding/EngagementProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  notificationPermission,
  type NotifyPermission,
  requestNotificationPermission,
  showSystemNotification,
} from "@/lib/notify";
import { setChecklistHidden, useEngagementStore, writePrefs } from "@/lib/onboarding/prefs";
import { cn } from "@/lib/utils";

import { SettingsCard } from "./SettingsCard";

type PermissionState = NotifyPermission | "unknown";

const PERMISSION_EVENT = "notification-permission-change";

/** Browser notification permission, read only in the browser (no hydration mismatch). */
function useNotificationPermission(): PermissionState {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(PERMISSION_EVENT, onChange);
      window.addEventListener("focus", onChange);
      document.addEventListener("visibilitychange", onChange);
      // Chrome/Edge/Brave report changes made in the site settings while the page is open.
      let status: PermissionStatus | null = null;
      navigator.permissions
        ?.query({ name: "notifications" })
        .then((s) => {
          status = s;
          s.addEventListener("change", onChange);
        })
        .catch(() => {});
      return () => {
        window.removeEventListener(PERMISSION_EVENT, onChange);
        window.removeEventListener("focus", onChange);
        document.removeEventListener("visibilitychange", onChange);
        status?.removeEventListener("change", onChange);
      };
    },
    notificationPermission,
    () => "unknown",
  );
}

/** "20:00" → "8:00 pm". */
const formatTime = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-GB", { hour: "numeric", hour12: true, minute: "2-digit" });
};

function Toggle({ checked, disabled, id, onChange }: { checked: boolean; disabled?: boolean; id: string; onChange: (value: boolean) => void }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        aria-hidden
        className={cn("bg-background size-5 rounded-full shadow-sm transition-transform", checked ? "translate-x-5.5" : "translate-x-0.5")}
      />
    </button>
  );
}

function Row({ children, description, htmlFor, icon: Icon, title }: { children: React.ReactNode; description: string; htmlFor: string; icon: typeof Bell; title: string }) {
  return (
    // Controls drop under the text on narrow screens instead of squeezing it.
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5 first:pt-0 last:pb-0">
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {title}
        </label>
        <p className="text-muted-foreground text-xs leading-5">{description}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Daily tip, daily reminder, browser notifications, and replaying setup/tour. */
export function NotificationSettings({ className }: { className?: string }) {
  const { checklistHidden, prefs, ready } = useEngagementStore();
  const permission = useNotificationPermission();
  const engagement = useEngagement();

  const [testing, setTesting] = useState(false);

  const allow = async (): Promise<PermissionState> => {
    const result = await requestNotificationPermission();
    window.dispatchEvent(new Event(PERMISSION_EVENT));
    if (result === "granted") toast.success("Notifications are on", { description: "Reminders and alerts can reach you even when this tab is in the background." });
    else if (result === "denied") toast.warning("Notifications are blocked", { description: "You’ll still get pop-ups while the app is open. You can allow them in the site settings." });
    return result;
  };

  const test = async () => {
    setTesting(true);
    try {
      let current: PermissionState = notificationPermission();
      if (current === "default") current = await allow();
      const title = "This is how reminders look";
      const body = "Tap to open Daily Expenses and add today’s spending.";
      if (current === "granted" && (await showSystemNotification(title, { body, tag: "test", url: "/expenses" }))) {
        toast.success("Test notification sent", {
          description:
            "Didn’t see it? Your computer may be hiding notifications from this browser — on a Mac, check System Settings → Notifications, and turn off Focus / Do Not Disturb.",
          duration: 10_000,
        });
        return;
      }
      // Not allowed or not supported: show what the in-app version looks like.
      toast.info(title, { description: body });
    } finally {
      setTesting(false);
    }
  };

  const permissionText: Record<PermissionState, string> = {
    default: "Not set up yet — allow them to get reminders when this tab is in the background.",
    denied: "Blocked in this browser. To turn them on, open the site settings (the icon left of the address) and allow notifications.",
    granted: "Allowed on this device.",
    unknown: "Checking what this browser allows…",
    unsupported: "This browser doesn’t support notifications — you’ll get pop-ups while the app is open.",
  };

  return (
    <SettingsCard
      className={className}
      icon={BellRing}
      title="Reminders & tips"
      description="Gentle nudges so the app keeps working for you. Saved on this device."
    >
      <div className="divide-y">
        <Row htmlFor="pref-tips" icon={Sparkles} title="Tips & quick questions" description="One “did you know…” tip and one quick check-in question a day, like “did you spend anything today?”">
          <Toggle id="pref-tips" checked={prefs.tips} disabled={!ready} onChange={(tips) => writePrefs({ tips })} />
        </Row>

        <Row
          htmlFor="pref-spending"
          icon={TrendingUp}
          title="Spending alerts"
          description="A heads-up when something stands out: a big expense, a busy day, a category past last month, or your monthly pace."
        >
          <Toggle
            id="pref-spending"
            checked={prefs.spendingAlerts}
            disabled={!ready}
            onChange={(spendingAlerts) => writePrefs({ spendingAlerts })}
          />
        </Row>

        <Row htmlFor="pref-reminder" icon={Bell} title="Daily reminder" description="A nudge to log what you spent today, at the time you choose.">
          <Input
            type="time"
            aria-label="Reminder time"
            value={prefs.reminderTime}
            disabled={!ready || !prefs.dailyReminder}
            onChange={(e) => e.target.value && writePrefs({ reminderTime: e.target.value })}
            className="h-9 w-36 tabular-nums"
          />
          <Toggle
            id="pref-reminder"
            checked={prefs.dailyReminder}
            disabled={!ready}
            onChange={(dailyReminder) => {
              writePrefs({ dailyReminder });
              if (dailyReminder) {
                toast.success(`Daily reminder set for ${formatTime(prefs.reminderTime)}`, {
                  description: "While the app is open you’ll get a pop-up; with notifications allowed, it reaches you in the background too.",
                });
                if (notificationPermission() === "default") void allow();
              }
            }}
          />
        </Row>

        <div className="flex flex-wrap items-center gap-3 py-3.5 last:pb-0">
          <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
            <BellRing className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Browser notifications</p>
            <p className="text-muted-foreground text-xs leading-5" aria-live="polite">
              {permissionText[permission]}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {permission === "default" && (
              <Button size="sm" onClick={() => void allow()}>
                Allow
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => void test()} disabled={testing}>
              {testing ? "Sending…" : "Send a test"}
            </Button>
          </div>
        </div>

        {engagement.enabled && (
          <div className="flex flex-wrap items-center gap-2 pt-3.5">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={engagement.startTour}>
              <Compass className="size-3.5" aria-hidden />
              Take the tour
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={engagement.openSetup}>
              <ListChecks className="size-3.5" aria-hidden />
              Run setup again
            </Button>
            {ready && checklistHidden && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setChecklistHidden(false);
                  toast.success("Checklist is back on Home");
                }}
              >
                Show the getting-started checklist
              </Button>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}
