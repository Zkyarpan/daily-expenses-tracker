/**
 * src/lib/onboarding/prefs.ts
 *
 * Device-level preferences for tips and the daily reminder, plus "done"
 * markers for actions that leave no record in the database (asking the AI,
 * scanning a receipt). Stored in localStorage because notification
 * permission is per browser anyway. Safe to import on the server (no-ops).
 */

import { useMemo, useSyncExternalStore } from "react";

import type { DoneFlags, TipId } from "./tips";

export interface EngagementPrefs {
  /** Daily "log today's spending" reminder. */
  dailyReminder: boolean;
  /** HH:MM, local time. */
  reminderTime: string;
  /** Pop-ups when something notable happens with spending (big spend, pace…). */
  spendingAlerts: boolean;
  /** One "did you know…" tip a day. */
  tips: boolean;
}

export const DEFAULT_PREFS: EngagementPrefs = { dailyReminder: false, reminderTime: "20:00", spendingAlerts: true, tips: true };

const KEYS = {
  checkIn: "check-in-last-answered",
  checklistHidden: "onboarding-checklist-hidden",
  done: "onboarding-done",
  lastReminder: "reminder-last-shown",
  lastTip: "tip-last-shown",
  prefs: "engagement-prefs",
  signalsSeen: "spending-signals-seen",
} as const;

const EVENT = "engagement-change";
const hasWindow = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage full or blocked: preferences just won't persist.
  }
}

export const readPrefs = (): EngagementPrefs => ({ ...DEFAULT_PREFS, ...read<Partial<EngagementPrefs>>(KEYS.prefs, {}) });
export const writePrefs = (patch: Partial<EngagementPrefs>) => write(KEYS.prefs, { ...readPrefs(), ...patch });

export const readDone = (): DoneFlags => read<DoneFlags>(KEYS.done, {});
export const markDone = (id: TipId) => {
  if (!readDone()[id]) write(KEYS.done, { ...readDone(), [id]: true });
};

export const readStamp = (key: "checkIn" | "lastReminder" | "lastTip") => read<string | null>(KEYS[key], null);
export const writeStamp = (key: "checkIn" | "lastReminder" | "lastTip", dateKey: string) => write(KEYS[key], dateKey);

/** Spending alerts already shown on this device (newest 300 ids). */
export const readSeenSignals = () => read<string[]>(KEYS.signalsSeen, []);
export const addSeenSignals = (ids: string[]) => write(KEYS.signalsSeen, [...readSeenSignals(), ...ids].slice(-300));

export const isChecklistHidden = () => read<boolean>(KEYS.checklistHidden, false);
export const setChecklistHidden = (hidden: boolean) => write(KEYS.checklistHidden, hidden);

// ─────────────────────────────────────────────────────────────────────────────
// React bindings (re-render when any of these change, in this or another tab)
// ─────────────────────────────────────────────────────────────────────────────

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** JSON snapshot so useSyncExternalStore gets a stable value between changes. */
const snapshot = () =>
  hasWindow()
    ? [KEYS.prefs, KEYS.done, KEYS.checklistHidden].map((k) => window.localStorage.getItem(k) ?? "").join("|")
    : "";

/**
 * Re-renders the caller when engagement storage changes. During hydration it
 * returns the same defaults the server rendered (`ready: false`), so markup
 * never mismatches; real values arrive right after.
 */
export function useEngagementStore() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(
    () =>
      snap
        ? { checklistHidden: isChecklistHidden(), done: readDone(), prefs: readPrefs(), ready: true }
        : { checklistHidden: false, done: {} as DoneFlags, prefs: DEFAULT_PREFS, ready: false },
    [snap],
  );
}

export const todayKey = (date = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
