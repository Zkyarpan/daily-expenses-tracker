/**
 * src/lib/money/summary.ts
 *
 * Pure calculations behind Lend & borrow, the Wishlist and "Savings this
 * month". All money is summed in integer pence so totals never drift.
 */

import type {
  Iou,
  IouSummary,
  MonthSavings,
  PersonBalance,
  Priority,
  WishlistItem,
  WishlistSummary,
} from "./schemas";

const toPence = (amount: number) => Math.round(amount * 100);
const fromPence = (pence: number) => pence / 100;

/** What is still owed on an IOU. */
export const outstanding = (iou: Pick<Iou, "amount" | "paidAmount">) =>
  fromPence(Math.max(0, toPence(iou.amount) - toPence(iou.paidAmount)));

export const isOverdue = (iou: Pick<Iou, "dueDate" | "settledAt">, today: string) =>
  !iou.settledAt && !!iou.dueDate && iou.dueDate < today;

/** Totals, per-person balances and overdue count. `today` is YYYY-MM-DD. */
export function summarizeIous(ious: readonly Iou[], today: string): IouSummary {
  let owedToMe = 0;
  let iOwe = 0;
  let openCount = 0;
  let overdueCount = 0;
  const byPerson = new Map<string, { balance: number; openCount: number; person: string }>();

  for (const iou of ious) {
    if (iou.settledAt) continue;
    const pence = toPence(outstanding(iou));
    if (pence === 0) continue;
    openCount++;
    if (isOverdue(iou, today)) overdueCount++;
    if (iou.direction === "lent") owedToMe += pence;
    else iOwe += pence;

    // Group case-insensitively, keep the first spelling seen.
    const key = iou.person.trim().toLowerCase();
    const entry = byPerson.get(key) ?? { balance: 0, openCount: 0, person: iou.person.trim() };
    entry.balance += iou.direction === "lent" ? pence : -pence;
    entry.openCount++;
    byPerson.set(key, entry);
  }

  const people: PersonBalance[] = [...byPerson.values()]
    .map((p) => ({ ...p, balance: fromPence(p.balance) }))
    .filter((p) => p.balance !== 0 || p.openCount > 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.person.localeCompare(b.person));

  return {
    iOwe: fromPence(iOwe),
    net: fromPence(owedToMe - iOwe),
    openCount,
    overdueCount,
    owedToMe: fromPence(owedToMe),
    people,
  };
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, low: 2, medium: 1 };

/** Open items first by priority, then nearest target date, then most saved (as a share). */
export function sortWishlist(items: readonly WishlistItem[]): WishlistItem[] {
  return [...items].sort((a, b) => {
    if (!!a.purchasedAt !== !!b.purchasedAt) return a.purchasedAt ? 1 : -1;
    if (a.purchasedAt && b.purchasedAt) return b.purchasedAt.localeCompare(a.purchasedAt);
    const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (byPriority !== 0) return byPriority;
    if (a.targetDate !== b.targetDate) {
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return a.targetDate.localeCompare(b.targetDate);
    }
    return b.savedAmount / b.price - a.savedAmount / a.price;
  });
}

export function summarizeWishlist(items: readonly WishlistItem[]): WishlistSummary {
  let total = 0;
  let saved = 0;
  let openCount = 0;
  let purchasedCount = 0;
  for (const item of items) {
    if (item.purchasedAt) {
      purchasedCount++;
      continue;
    }
    openCount++;
    total += toPence(item.price);
    saved += Math.min(toPence(item.savedAmount), toPence(item.price));
  }
  return {
    openCount,
    purchasedCount,
    remaining: fromPence(total - saved),
    saved: fromPence(saved),
    total: fromPence(total),
  };
}

/**
 * Savings for one month: what is left of the income so far, where the month
 * is heading at the current spending rate, and how much can still be spent
 * while hitting the savings goal.
 *
 * @param today YYYY-MM-DD in the user's time zone; the month is taken from it.
 */
export function monthSavings({
  goal,
  income,
  spent,
  today,
}: {
  goal: number | null;
  income: number | null;
  spent: number;
  today: string;
}): MonthSavings {
  const [year, month, day] = today.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysElapsed = Math.min(Math.max(day, 1), daysInMonth);
  const daysLeft = daysInMonth - daysElapsed + 1; // today included

  const spentPence = toPence(spent);
  const projectedSpendPence = Math.round((spentPence / daysElapsed) * daysInMonth);
  const incomePence = income === null ? null : toPence(income);
  const goalPence = goal === null ? null : toPence(goal);

  const savedSoFar = incomePence === null ? null : fromPence(incomePence - spentPence);
  const projectedSavings = incomePence === null ? null : fromPence(incomePence - projectedSpendPence);
  const safePence = incomePence === null ? null : Math.max(0, incomePence - (goalPence ?? 0) - spentPence);

  let status: MonthSavings["status"] = null;
  if (incomePence !== null && goalPence !== null) {
    const projected = incomePence - projectedSpendPence;
    const now = incomePence - spentPence;
    status = now < goalPence ? "off-track" : projected >= goalPence ? "on-track" : "at-risk";
  }

  return {
    daysElapsed,
    daysInMonth,
    daysLeft,
    goal,
    income,
    month: today.slice(0, 7),
    projectedSavings,
    projectedSpend: fromPence(projectedSpendPence),
    safeToSpend: safePence === null ? null : fromPence(safePence),
    safeToSpendPerDay: safePence === null ? null : fromPence(Math.floor(safePence / daysLeft)),
    savedSoFar,
    spent: fromPence(spentPence),
    status,
  };
}
