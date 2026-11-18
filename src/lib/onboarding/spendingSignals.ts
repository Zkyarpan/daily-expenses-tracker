/**
 * src/lib/onboarding/spendingSignals.ts
 *
 * "Something happened with your spending" alerts, worked out in code from
 * this month's and last month's expenses (no AI, no figures leave the
 * device). Each signal has a stable id so it is shown once:
 *
 *   big:<expenseId>          a recent expense far above your usual size
 *   day:<YYYY-MM-DD>         today's spending is well above a normal day
 *   cat:<YYYY-MM>:<name>     a category has passed all of last month already
 *   pace-high:<YYYY-MM>      on pace to spend 20%+ more than last month
 *   pace-low:<YYYY-MM>       on pace to spend 15%+ less (good news)
 *   week:<YYYY-MM-DD>        Monday recap of the last 7 days
 *
 * Budget alerts (80% / 100% of a limit) live in the alerts system; these
 * cover people who haven't set budgets too.
 */

export interface SignalExpense {
  amount: number;
  categoryName?: string | null;
  /** YYYY-MM-DD (local) or a Date. */
  date: string | Date;
  description?: string | null;
  id: string;
}

export interface SpendingSignal {
  actionLabel: string;
  body: string;
  href: string;
  id: string;
  /** Higher first. */
  priority: number;
  title: string;
  tone: "info" | "success" | "warning";
}

const GBP = new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" });
const fmt = (n: number) => GBP.format(Math.round(n * 100) / 100);
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyOf = (date: string | Date) => (date instanceof Date ? dayKey(date) : String(date).slice(0, 10));
const sum = (rows: readonly SignalExpense[]) => rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const monthName = (d: Date) => d.toLocaleDateString("en-GB", { month: "long" });
const shortDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function spendingSignals({
  format = fmt,
  lastMonth,
  thisMonth,
  today,
}: {
  /** Amount formatter (the app passes the chosen currency's); GBP by default. */
  format?: (amount: number) => string;
  lastMonth: readonly SignalExpense[];
  thisMonth: readonly SignalExpense[];
  today: Date;
}): SpendingSignal[] {
  const signals: SpendingSignal[] = [];
  const todayKey = dayKey(today);
  const monthKey = todayKey.slice(0, 7);
  const day = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const daysInLastMonth = new Date(previous.getFullYear(), previous.getMonth() + 1, 0).getDate();
  const lastName = monthName(previous);

  // Only this month's rows up to today (future-dated entries don't count yet).
  const current = thisMonth.filter((e) => keyOf(e.date).slice(0, 7) === monthKey && keyOf(e.date) <= todayKey);
  const total = sum(current);
  const lastTotal = sum(lastMonth);

  // ── A big one-off expense in the last two days ─────────────────────────────
  const recentFrom = dayKey(new Date(today.getFullYear(), today.getMonth(), day - 2));
  const sizes = [...current, ...lastMonth].map((e) => Number(e.amount) || 0).filter((n) => n > 0);
  const typical = sizes.length >= 4 ? median(sizes) : 0;
  const bigLine = typical > 0 ? Math.max(100, typical * 3) : 150;
  const big = current
    .filter((e) => keyOf(e.date) >= recentFrom && e.amount >= bigLine)
    .sort((a, b) => b.amount - a.amount)[0];
  if (big) {
    const times = typical > 0 ? Math.round(big.amount / typical) : null;
    signals.push({
      actionLabel: "View expenses",
      body: `${big.description?.trim() || "No description"} · ${shortDay(keyOf(big.date))}.${
        times && times >= 3 ? ` About ${times}× your typical expense.` : ""
      }`,
      href: "/expenses",
      id: `big:${big.id}`,
      priority: 4,
      title: `Big spend: ${format(big.amount)}${big.categoryName ? ` on ${big.categoryName}` : ""}`,
      tone: "warning",
    });
  }

  // ── A busy day ─────────────────────────────────────────────────────────────
  const todayTotal = sum(current.filter((e) => keyOf(e.date) === todayKey));
  const pastDays = day - 1 + (lastMonth.length ? daysInLastMonth : 0);
  const usualDay = pastDays > 0 ? (total - todayTotal + lastTotal) / pastDays : 0;
  if (usualDay > 0 && todayTotal >= Math.max(30, usualDay * 2.5)) {
    signals.push({
      actionLabel: "See today",
      body: `About ${Math.round(todayTotal / usualDay)}× what you usually spend in a day (${format(usualDay)}).`,
      href: "/expenses",
      id: `day:${todayKey}`,
      priority: 3,
      title: `Busy spending day: ${format(todayTotal)} so far`,
      tone: "info",
    });
  }

  // ── A category has already passed all of last month ───────────────────────
  const byCategory = (rows: readonly SignalExpense[]) => {
    const map = new Map<string, number>();
    for (const e of rows) map.set(e.categoryName || "Uncategorized", (map.get(e.categoryName || "Uncategorized") ?? 0) + e.amount);
    return map;
  };
  const lastByCategory = byCategory(lastMonth);
  const overshoot = [...byCategory(current).entries()]
    .map(([name, amount]) => ({ amount, before: lastByCategory.get(name) ?? 0, name }))
    .filter((c) => c.name !== "Uncategorized" && c.before >= 20 && c.amount > c.before)
    .sort((a, b) => b.amount / b.before - a.amount / a.before)[0];
  if (overshoot && day < daysInMonth) {
    signals.push({
      actionLabel: "Set a budget",
      body: `${format(overshoot.amount)} so far this month, against ${format(overshoot.before)} in all of ${lastName}.`,
      href: "/budgets",
      id: `cat:${monthKey}:${overshoot.name}`,
      priority: 2,
      title: `${overshoot.name}: already more than all of ${lastName}`,
      tone: "warning",
    });
  }

  // ── Pace for the month ─────────────────────────────────────────────────────
  if (day >= 7 && lastTotal >= 50 && total > 0) {
    const projected = (total / day) * daysInMonth;
    const ratio = projected / lastTotal;
    if (ratio >= 1.2) {
      signals.push({
        actionLabel: "See where it goes",
        body: `About ${Math.round((ratio - 1) * 100)}% more than ${lastName} (${format(lastTotal)}). Small cuts now add up.`,
        href: "/analytics",
        id: `pace-high:${monthKey}`,
        priority: 1,
        title: `On pace to spend ${format(projected)} this month`,
        tone: "warning",
      });
    } else if (day >= 15 && ratio <= 0.85) {
      signals.push({
        actionLabel: "See your month",
        body: `On pace for ${format(projected)} — ${Math.round((1 - ratio) * 100)}% under ${lastName}. Keep it up!`,
        href: "/analytics",
        id: `pace-low:${monthKey}`,
        priority: 1,
        title: "Nice — you’re spending less this month",
        tone: "success",
      });
    }
  }

  // ── Monday recap of the last 7 days ────────────────────────────────────────
  if (today.getDay() === 1) {
    const weekFrom = dayKey(new Date(today.getFullYear(), today.getMonth(), day - 7));
    const week = [...thisMonth, ...lastMonth].filter((e) => {
      const k = keyOf(e.date);
      return k >= weekFrom && k < todayKey;
    });
    if (week.length > 0) {
      const top = [...byCategory(week).entries()].sort((a, b) => b[1] - a[1])[0];
      signals.push({
        actionLabel: "Open analytics",
        body: `${week.length} ${week.length === 1 ? "expense" : "expenses"}${top ? ` · most on ${top[0]} (${format(top[1])})` : ""}.`,
        href: "/analytics",
        id: `week:${todayKey}`,
        priority: 0,
        title: `Last week you spent ${format(sum(week))}`,
        tone: "info",
      });
    }
  }

  return signals.sort((a, b) => b.priority - a.priority);
}
