/**
 * src/lib/onboarding/tips.ts
 *
 * "Did you know…" feature tips and the daily reminder: which tip to show
 * today, and whether the reminder is due. Pure functions, so the behaviour
 * is unit tested; the browser side lives in src/components/onboarding.
 */

import type { InterestId } from "./schemas";

/** Things the user has already done, so tips never nag about them. */
export type DoneFlags = Partial<Record<TipId, boolean>>;

export type TipId =
  | "ask-ai"
  | "budget"
  | "goal"
  | "iou"
  | "plan"
  | "receipt"
  | "search"
  | "wishlist";

export interface Tip {
  /** Where "Try it" takes the user (or a quick action). */
  action: { href?: string; label: string; quickAdd?: "iou" | "receipt" | "wishlist" };
  description: string;
  id: TipId;
  /** Interests this tip matters most for (shown first). */
  interests: InterestId[];
  title: string;
}

export const TIPS: Tip[] = [
  {
    action: { label: "Scan one", quickAdd: "receipt" },
    description: "Snap a photo of a receipt and AI fills in the shop, total and date for you to check.",
    id: "receipt",
    interests: ["track"],
    title: "Tip: scan receipts instead of typing",
  },
  {
    action: { href: "/assistant", label: "Ask AI" },
    description: "Ask things like “How much did I spend on TfL this month?” — answers come from your own data.",
    id: "ask-ai",
    interests: ["insights", "track"],
    title: "Tip: ask about your money",
  },
  {
    action: { href: "/budgets", label: "Set a budget" },
    description: "Give a category a monthly limit and you’ll get an alert at 80% and when you go over.",
    id: "budget",
    interests: ["budget"],
    title: "Tip: set a monthly budget",
  },
  {
    action: { label: "Add one", quickAdd: "iou" },
    description: "Lent a friend £20? Record it and mark it settled when they pay you back.",
    id: "iou",
    interests: ["owe"],
    title: "Tip: track who owes who",
  },
  {
    action: { href: "/plan", label: "Open plan" },
    description: "Your savings plan shows what’s left after rent and goals — and where saving gets you in 2 years.",
    id: "plan",
    interests: ["save"],
    title: "Tip: see your long-term savings",
  },
  {
    action: { href: "/plan", label: "Add a goal" },
    description: "Add a goal with a date and the app works out how much to put aside each month.",
    id: "goal",
    interests: ["save"],
    title: "Tip: give your savings a target",
  },
  {
    action: { label: "Add an item", quickAdd: "wishlist" },
    description: "Put things you want on your wishlist, save towards them, and see when you can afford them.",
    id: "wishlist",
    interests: ["wishlist"],
    title: "Tip: save up for things you want",
  },
  {
    action: { label: "Got it" },
    description: "Press ⌘K (Ctrl+K on Windows) anywhere to jump to any page or switch theme.",
    id: "search",
    interests: [],
    title: "Tip: get anywhere in a keystroke",
  },
];

/** Days since 1970 for a YYYY-MM-DD key (stable daily rotation). */
const dayNumber = (dateKey: string) => Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);

/**
 * Today's tip: tips for the user's interests first, skipping anything they
 * have already done; rotates daily through what is left. Null when there is
 * nothing useful to say.
 */
export function pickTip({
  dateKey,
  done,
  interests,
}: {
  dateKey: string;
  done: DoneFlags;
  interests: readonly InterestId[];
}): Tip | null {
  const open = TIPS.filter((t) => !done[t.id]);
  if (open.length === 0) return null;
  const relevant = open.filter((t) => t.interests.some((i) => interests.includes(i)));
  const pool = relevant.length > 0 ? relevant : open;
  return pool[((dayNumber(dateKey) % pool.length) + pool.length) % pool.length];
}

/**
 * Is the daily reminder due? True from `time` (HH:MM, local) onwards, once
 * per day.
 */
export function isReminderDue({ lastShown, now, time }: { lastShown: string | null; now: Date; time: string }): boolean {
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (lastShown === today) return false;
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
}
