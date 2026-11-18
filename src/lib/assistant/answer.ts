/**
 * src/lib/assistant/answer.ts
 *
 * Builds the assistant's replies from the user's data. Every figure in a
 * reply is calculated here (in integer pence), never written by the AI, so
 * answers cannot invent numbers.
 *
 * Pure module — the data is fetched by src/lib/assistant/server.ts.
 */

import { DEFAULT_CATEGORIES, DEFAULT_TAGS } from "@/lib/config";
import type { Iou, MonthSavings, WishlistItem } from "@/lib/money/schemas";
import { outstanding } from "@/lib/money/summary";
import type { PlanSummary } from "@/lib/plan/schemas";

import type { AssistantContext, AssistantQuery, ResolvedPeriod } from "./query";

export interface AssistantAnswer {
  /** Carried into the next question (for "him", "and last month?"). */
  context: AssistantContext;
  facts: { label: string; value: string }[];
  followUps: string[];
  items: { amount: string; subtitle: string; title: string }[];
  link: { href: string; label: string } | null;
  text: string;
}

const GBP = new Intl.NumberFormat("en-GB", { currency: "GBP", style: "currency" });
export const gbp = (amount: number) => GBP.format(amount);
const toPence = (v: number) => Math.round(v * 100);
const fromPence = (p: number) => p / 100;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const formatDay = (key: string) =>
  new Date(`${key.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" });

const CATEGORY_NAME = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.name]));
const TAG_NAME = new Map(DEFAULT_TAGS.map((t) => [t.id, t.name]));

const answer = (fields: Partial<AssistantAnswer> & Pick<AssistantAnswer, "text">): AssistantAnswer => ({
  context: {},
  facts: [],
  followUps: [],
  items: [],
  link: null,
  ...fields,
});

// ─────────────────────────────────────────────────────────────────────────────
// Spending
// ─────────────────────────────────────────────────────────────────────────────

export type SpendRow = {
  amount: number;
  categoryId: string | null;
  date: string;
  description: string | null;
  tagId: string | null;
};

const normalise = (text: string) => text.toLowerCase().replace(/[^a-z0-9&]+/g, " ").trim();

/** Does an expense match the question's subject (category, or a word in its description/place)? */
export function matchesSpending(row: SpendRow, query: Pick<AssistantQuery, "categoryId" | "search">): boolean {
  if (query.categoryId) return row.categoryId === query.categoryId;
  if (!query.search) return true;
  const needle = normalise(query.search);
  if (!needle) return true;
  const haystack = normalise(
    [row.description ?? "", row.tagId ? (TAG_NAME.get(row.tagId) ?? row.tagId) : "", row.categoryId ? (CATEGORY_NAME.get(row.categoryId) ?? "") : ""].join(" "),
  );
  if (` ${haystack} `.includes(` ${needle} `)) return true;
  // Longer terms may also match inside a word ("oyster" → "oystercard"); short ones
  // must match a whole word, so "tfl" never matches "netflix".
  const compact = needle.replace(/ /g, "");
  return compact.length >= 5 && haystack.replace(/ /g, "").includes(compact);
}

export function answerSpending({
  current,
  period,
  previous,
  query,
}: {
  current: readonly SpendRow[];
  period: ResolvedPeriod;
  previous: readonly SpendRow[] | null;
  query: AssistantQuery;
}): AssistantAnswer {
  const rows = current.filter((r) => matchesSpending(r, query)).sort((a, b) => b.date.localeCompare(a.date));
  const totalPence = rows.reduce((s, r) => s + toPence(r.amount), 0);
  const subject = query.categoryId
    ? (CATEGORY_NAME.get(query.categoryId) ?? "that category").toLowerCase()
    : query.search
      ? query.search
      : null;
  const onSubject = subject ? ` on ${subject}` : "";
  const context: AssistantContext = {
    categoryId: query.categoryId,
    intent: "spending",
    period: null,
    search: query.search,
  };

  const followUps = subject
    ? [`How much${onSubject} last month?`, `How much${onSubject} this year?`, "How much have I saved this month?"]
    : ["How much did I spend on groceries this month?", "How much did I spend last month?", "Who owes me money?"];

  if (rows.length === 0) {
    return answer({
      context,
      followUps: subject ? [`How much${onSubject} in total?`, ...followUps.slice(0, 2)] : followUps,
      link: { href: "/expenses", label: "Open expenses" },
      text: subject
        ? `I couldn’t find any spending${onSubject} ${period.label}.`
        : `You haven’t recorded any spending ${period.label}.`,
    });
  }

  const total = fromPence(totalPence);
  let text = `You spent ${gbp(total)}${onSubject} ${period.label} — ${plural(rows.length, "transaction")}.`;

  if (previous && period.previous) {
    const prevPence = previous.filter((r) => matchesSpending(r, query)).reduce((s, r) => s + toPence(r.amount), 0);
    const diff = totalPence - prevPence;
    if (prevPence > 0 && diff !== 0) {
      text += ` That’s ${gbp(fromPence(Math.abs(diff)))} ${diff > 0 ? "more" : "less"} than ${period.previous.label} (${gbp(fromPence(prevPence))}).`;
    } else if (prevPence > 0) {
      text += ` The same as ${period.previous.label}.`;
    }
  }

  const biggest = rows.reduce((max, r) => (r.amount > max.amount ? r : max), rows[0]);
  return answer({
    context,
    facts: [
      { label: "Total", value: gbp(total) },
      { label: "Transactions", value: String(rows.length) },
      { label: "Average", value: gbp(fromPence(Math.round(totalPence / rows.length))) },
      { label: "Biggest", value: gbp(biggest.amount) },
    ],
    followUps,
    items: rows.slice(0, 5).map((r) => ({
      amount: gbp(r.amount),
      subtitle: [formatDay(r.date), r.categoryId ? CATEGORY_NAME.get(r.categoryId) : "Uncategorized"].filter(Boolean).join(" · "),
      title: r.description || "Expense",
    })),
    link: { href: "/expenses", label: "Open expenses" },
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lend & borrow
// ─────────────────────────────────────────────────────────────────────────────

/** Finds the person the question means: exact, then starts-with, then contains. */
export function matchPerson(name: string, people: readonly string[]): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const unique = [...new Map(people.map((p) => [p.trim().toLowerCase(), p.trim()])).values()];
  return (
    unique.find((p) => p.toLowerCase() === n) ??
    unique.find((p) => p.toLowerCase().startsWith(n) || n.startsWith(p.toLowerCase())) ??
    unique.find((p) => p.toLowerCase().includes(n)) ??
    null
  );
}

export function answerOwed({ ious, query, today }: { ious: readonly Iou[]; query: AssistantQuery; today: string }): AssistantAnswer {
  const open = ious.filter((i) => !i.settledAt && outstanding(i) > 0);
  const link = { href: "/lend-borrow", label: "Open Lend & borrow" };

  if (query.person) {
    const person = matchPerson(query.person, ious.map((i) => i.person));
    if (!person) {
      return answer({
        followUps: ["Who owes me money?", "Who do I owe?"],
        link,
        text: `I couldn’t find anyone called ${query.person} in Lend & borrow. Add them with “+ New → Money I lent / borrowed”.`,
      });
    }
    const theirs = open.filter((i) => i.person.trim().toLowerCase() === person.toLowerCase());
    const balance = theirs.reduce((s, i) => s + (i.direction === "lent" ? 1 : -1) * toPence(outstanding(i)), 0);
    const overdue = theirs.filter((i) => i.dueDate && i.dueDate < today);
    const nextDue = theirs.filter((i) => i.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];

    let text =
      balance > 0
        ? `${person} owes you ${gbp(fromPence(balance))}.`
        : balance < 0
          ? `You owe ${person} ${gbp(fromPence(-balance))}.`
          : theirs.length === 0
            ? `You and ${person} are all square — nothing is owed either way.`
            : `It evens out: you and ${person} owe each other the same amount.`;
    if (overdue.length > 0) text += ` ${plural(overdue.length, "entry")} ${overdue.length === 1 ? "is" : "are"} overdue.`;
    else if (nextDue?.dueDate) text += ` Next one is due ${formatDay(nextDue.dueDate)}.`;

    return answer({
      context: { intent: "owed", person },
      facts:
        theirs.length > 0
          ? [
              { label: balance >= 0 ? "Owes you" : "You owe", value: gbp(fromPence(Math.abs(balance))) },
              { label: "Open entries", value: String(theirs.length) },
            ]
          : [],
      followUps: balance > 0 ? ["Who else owes me?", "Who do I owe?"] : ["Who owes me money?", "Who do I owe?"],
      items: theirs.slice(0, 5).map((i) => ({
        amount: gbp(outstanding(i)),
        subtitle: [
          i.direction === "lent" ? "They owe you" : "You owe",
          formatDay(i.date),
          i.paidAmount > 0 ? `${gbp(i.paidAmount)} paid back` : null,
          i.dueDate ? `due ${formatDay(i.dueDate)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        title: i.description || (i.direction === "lent" ? "Money lent" : "Money borrowed"),
      })),
      link,
      text,
    });
  }

  // Everyone
  const byPerson = new Map<string, number>();
  for (const i of open) {
    const name = i.person.trim();
    byPerson.set(name, (byPerson.get(name) ?? 0) + (i.direction === "lent" ? 1 : -1) * toPence(outstanding(i)));
  }
  const owedToMe = [...byPerson].filter(([, b]) => b > 0).sort((a, b) => b[1] - a[1]);
  const iOwe = [...byPerson].filter(([, b]) => b < 0).sort((a, b) => a[1] - b[1]);
  const sum = (list: [string, number][]) => fromPence(Math.abs(list.reduce((s, [, b]) => s + b, 0)));
  const names = (list: [string, number][]) => list.slice(0, 4).map(([n, b]) => `${n} ${gbp(fromPence(Math.abs(b)))}`).join(", ");

  let text: string;
  let list: [string, number][];
  if (query.direction === "owed_to_me") {
    list = owedToMe;
    text = owedToMe.length ? `People owe you ${gbp(sum(owedToMe))}: ${names(owedToMe)}.` : "Nobody owes you anything right now.";
  } else if (query.direction === "i_owe") {
    list = iOwe;
    text = iOwe.length ? `You owe ${gbp(sum(iOwe))} in total: ${names(iOwe)}.` : "You don’t owe anyone anything right now.";
  } else {
    list = [...owedToMe, ...iOwe];
    text =
      owedToMe.length || iOwe.length
        ? `People owe you ${gbp(sum(owedToMe))} and you owe ${gbp(sum(iOwe))}.`
        : "Nobody owes anyone anything — you’re all square.";
  }

  return answer({
    context: { intent: "owed", person: list.length === 1 ? list[0][0] : null },
    facts: [
      { label: "Owed to you", value: gbp(sum(owedToMe)) },
      { label: "You owe", value: gbp(sum(iOwe)) },
    ],
    followUps: list[0] ? [`How much does ${list[0][0]} owe me?`, query.direction === "i_owe" ? "Who owes me money?" : "Who do I owe?"] : ["How much have I saved this month?"],
    items: list.slice(0, 6).map(([name, b]) => ({
      amount: gbp(fromPence(Math.abs(b))),
      subtitle: b > 0 ? "Owes you" : "You owe",
      title: name,
    })),
    link,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings this month
// ─────────────────────────────────────────────────────────────────────────────

export function answerSavings(savings: MonthSavings): AssistantAnswer {
  const link = { href: "/plan", label: "Open savings plan" };
  if (savings.income === null) {
    return answer({
      facts: [{ label: "Spent this month", value: gbp(savings.spent) }],
      followUps: ["How much did I spend this month?"],
      link: { href: "/plan", label: "Add your salary" },
      text: `You’ve spent ${gbp(savings.spent)} this month. Add your monthly salary on the Savings plan page and I can tell you how much you’re saving.`,
    });
  }

  const saved = savings.savedSoFar ?? 0;
  let text = `This month you’ve spent ${gbp(savings.spent)} of your ${gbp(savings.income)} income, so you’ve kept ${gbp(saved)} so far.`;
  if (savings.goal !== null && savings.projectedSavings !== null) {
    text +=
      savings.status === "on-track"
        ? ` At this pace you’ll save about ${gbp(savings.projectedSavings)} — on track for your ${gbp(savings.goal)} goal.`
        : savings.status === "at-risk"
          ? ` At this pace you’ll save about ${gbp(Math.max(0, savings.projectedSavings))}, short of your ${gbp(savings.goal)} goal.`
          : ` You’re already below your ${gbp(savings.goal)} savings goal.`;
  } else if (savings.projectedSavings !== null) {
    text += ` At this pace you’ll end the month with about ${gbp(savings.projectedSavings)} saved.`;
  }
  if (savings.safeToSpend !== null && savings.safeToSpendPerDay !== null) {
    text +=
      savings.safeToSpend > 0
        ? ` You can still spend ${gbp(savings.safeToSpend)} (about ${gbp(savings.safeToSpendPerDay)} a day)${savings.goal !== null ? " and hit your goal" : ""}.`
        : " There’s nothing left to spend this month without dipping into savings.";
  }

  return answer({
    context: { intent: "savings" },
    facts: [
      { label: "Income", value: gbp(savings.income) },
      { label: "Spent so far", value: gbp(savings.spent) },
      { label: "Saved so far", value: gbp(saved) },
      ...(savings.safeToSpend !== null ? [{ label: "Safe to spend", value: gbp(savings.safeToSpend) }] : []),
    ],
    followUps: ["How much should I save to reach my goals?", "How much did I spend on groceries this month?"],
    link,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Savings plan
// ─────────────────────────────────────────────────────────────────────────────

export function answerPlan(plan: PlanSummary | null, savings: MonthSavings): AssistantAnswer {
  const link = { href: "/plan", label: "Open savings plan" };
  if (!plan) {
    const base = answerSavings(savings);
    return { ...base, link, text: `${base.text} Set up your savings plan (fixed costs and goals) to see a monthly plan.` };
  }
  if (plan.income === null) {
    return answer({
      link: { href: "/plan", label: "Add your salary" },
      text: "Add your monthly salary on the Savings plan page, along with rent and bills, and I’ll work out how much to save.",
    });
  }

  let text = `From your ${gbp(plan.income)} income, fixed costs take ${gbp(plan.fixedTotal)}, leaving ${gbp(plan.afterFixed ?? 0)}.`;
  if (plan.goals.length > 0) {
    text += ` To reach your goals on time, save ${gbp(plan.goalsMonthly)} a month — that leaves ${gbp(Math.max(0, plan.leftToSpend ?? 0))} for everyday spending (about ${gbp(plan.leftToSpendPerDay ?? 0)} a day).`;
  } else {
    text += " Add a savings goal and I’ll tell you how much to put aside each month.";
  }
  if (plan.avgSaved !== null) text += ` Lately you’ve saved about ${gbp(plan.avgSaved)} a month.`;
  if (plan.status === "behind" && plan.avgSaved !== null) {
    text += ` To catch up, spend about ${gbp(plan.goalsMonthly - plan.avgSaved)} less a month.`;
  } else if (plan.status === "goals-unaffordable") {
    text += " Your goals need more than you have after fixed costs — move a deadline back or lower a target.";
  } else if (plan.status === "on-track") {
    text += " You’re on track.";
  }

  return answer({
    context: { intent: "plan" },
    facts: [
      { label: "Income", value: gbp(plan.income) },
      { label: "Fixed costs", value: gbp(plan.fixedTotal) },
      { label: "Save each month", value: gbp(plan.goalsMonthly) },
      { label: "Left to spend", value: gbp(Math.max(0, plan.leftToSpend ?? 0)) },
    ],
    followUps: ["How much have I saved this month?", "Can I afford the headphones?"],
    items: plan.goals.slice(0, 5).map((g) => ({
      amount: g.monthlyNeed === null ? "No deadline" : `${gbp(g.monthlyNeed)}/month`,
      subtitle: `${gbp(g.savedAmount)} of ${gbp(g.targetAmount)}${g.targetDate ? ` · by ${formatDay(g.targetDate)}` : ""}`,
      title: g.name,
    })),
    link,
    text,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export function answerWishlist({
  items,
  query,
  safeToSpend,
}: {
  items: readonly WishlistItem[];
  query: AssistantQuery;
  safeToSpend: number | null;
}): AssistantAnswer {
  const link = { href: "/wishlist", label: "Open wishlist" };
  const open = items.filter((i) => !i.purchasedAt);

  if (query.item) {
    const needle = query.item.toLowerCase();
    const item =
      open.find((i) => i.name.toLowerCase() === needle) ??
      open.find((i) => i.name.toLowerCase().includes(needle) || needle.includes(i.name.toLowerCase())) ??
      open.find((i) => needle.split(/\s+/).some((w) => w.length > 3 && i.name.toLowerCase().includes(w)));
    if (!item) {
      return answer({
        followUps: ["What’s on my wishlist?"],
        link,
        text: `“${query.item}” isn’t on your wishlist. Add it with “+ New → Wishlist item” and I can track it.`,
      });
    }
    const remaining = fromPence(Math.max(0, toPence(item.price) - toPence(item.savedAmount)));
    let text =
      remaining === 0
        ? `You’ve saved the full ${gbp(item.price)} for ${item.name} — you can buy it.`
        : `You’ve saved ${gbp(item.savedAmount)} of ${gbp(item.price)} for ${item.name} — ${gbp(remaining)} to go.`;
    if (remaining > 0 && safeToSpend !== null) {
      text +=
        remaining <= safeToSpend
          ? ` You have ${gbp(safeToSpend)} safe to spend this month, so you could buy it now and still hit your savings goal.`
          : ` That’s more than the ${gbp(safeToSpend)} safe to spend this month — putting aside ${gbp(Math.ceil(remaining / 3))} a month gets you there in 3 months.`;
    }
    return answer({
      facts: [
        { label: "Price", value: gbp(item.price) },
        { label: "Saved", value: gbp(item.savedAmount) },
        { label: "To go", value: gbp(remaining) },
      ],
      followUps: ["What’s on my wishlist?", "How much have I saved this month?"],
      link,
      text,
    });
  }

  const total = open.reduce((s, i) => s + toPence(i.price), 0);
  const saved = open.reduce((s, i) => s + Math.min(toPence(i.savedAmount), toPence(i.price)), 0);
  return answer({
    facts: [
      { label: "Items", value: String(open.length) },
      { label: "Total", value: gbp(fromPence(total)) },
      { label: "Saved", value: gbp(fromPence(saved)) },
    ],
    followUps: open[0] ? [`Can I afford the ${open[0].name.toLowerCase()}?`] : [],
    items: open.slice(0, 5).map((i) => ({
      amount: gbp(i.price),
      subtitle: `${gbp(i.savedAmount)} saved`,
      title: i.name,
    })),
    link,
    text: open.length
      ? `You have ${plural(open.length, "item")} on your wishlist worth ${gbp(fromPence(total))}, with ${gbp(fromPence(saved))} saved towards them.`
      : "Your wishlist is empty.",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────────────────────────────────────

export const answerHelp = (): AssistantAnswer =>
  answer({
    followUps: [
      "How much did I spend on TfL this month?",
      "Who owes me money?",
      "How much have I saved this month?",
      "How much should I save to reach my goals?",
    ],
    text: "Ask me about your money in plain English — what you spent (on a shop, a category or in a period), who owes who, what you’ve saved this month, your savings plan, or whether you can afford something on your wishlist.",
  });
