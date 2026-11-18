"use client";

import { useSyncExternalStore } from "react";
import { Bell, BellRing, Compass, ListChecks, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useEngagement } from "@/components/onboarding/EngagementProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setChecklistHidden, useEngagementStore, writePrefs } from "@/lib/onboarding/prefs";
import { cn } from "@/lib/utils";

import { SettingsCard } from "./SettingsCard";

type PermissionState = NotificationPermission | "unsupported" | "unknown";

const PERMISSION_EVENT = "notification-permission-change";

/** Browser notification permission, read only in the browser (no hydration mismatch). */
function useNotificationPermission(): PermissionState {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(PERMISSION_EVENT, onChange);
      window.addEventListener("focus", onChange);
      return () => {
        window.removeEventListener(PERMISSION_EVENT, onChange);
        window.removeEventListener("focus", onChange);
      };
    },
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unknown",
  );
}

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
    <div className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="block text-sm font-medium">
          {title}
        </label>
        <p className="text-muted-foreground text-xs leading-5">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

/** Daily tip, daily reminder, browser notifications, and replaying setup/tour. */
export function NotificationSettings({ className }: { className?: string }) {
  const { checklistHidden, prefs, ready } = useEngagementStore();
  const permission = useNotificationPermission();
  const engagement = useEngagement();

  const allow = async () => {
    const result = await Notification.requestPermission();
    window.dispatchEvent(new Event(PERMISSION_EVENT));
    if (result === "granted") toast.success("Notifications are on", { description: "Reminders can reach you even when this tab is in the background." });
    else toast.warning("Notifications not allowed", { description: "You’ll still get pop-ups while the app is open." });
  };

  const test = () => {
    const title = "This is how reminders look";
    const body = "Tap to open Daily Expenses and add today’s spending.";
    if (permission === "granted") {
      try {
        const n = new Notification(title, { body, icon: "/icon.svg" });
        n.onclick = () => {
          window.focus();
          n.close();
        };
        return;
      } catch {
        // Some browsers (e.g. Android Chrome) only allow notifications from a service worker.
      }
    }
    toast.info(title, { description: body });
  };

  const permissionText: Record<PermissionState, string> = {
    default: "Not set up yet — allow them to get reminders when this tab is in the background.",
    denied: "Blocked in this browser. To turn them on, open the site settings (the icon left of the address) and allow notifications.",
    granted: "Allowed on this device.",
    unknown: "Checking…",
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
        <Row htmlFor="pref-tips" icon={Sparkles} title="One tip a day" description="A short “did you know…” pop-up about a feature you haven’t tried yet.">
          <Toggle id="pref-tips" checked={prefs.tips} disabled={!ready} onChange={(tips) => writePrefs({ tips })} />
        </Row>

        <Row htmlFor="pref-reminder" icon={Bell} title="Daily reminder" description="A nudge to log what you spent today, at the time you choose.">
          <Input
            type="time"
            aria-label="Reminder time"
            value={prefs.reminderTime}
            disabled={!ready || !prefs.dailyReminder}
            onChange={(e) => e.target.value && writePrefs({ reminderTime: e.target.value })}
            className="h-8 w-28"
          />
          <Toggle
            id="pref-reminder"
            checked={prefs.dailyReminder}
            disabled={!ready}
            onChange={(dailyReminder) => {
              writePrefs({ dailyReminder });
              if (dailyReminder && permission === "default") void allow();
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
            <Button size="sm" variant="outline" onClick={test} disabled={permission === "unknown"}>
              Send a test
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
