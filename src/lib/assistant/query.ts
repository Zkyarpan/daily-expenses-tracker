/**
 * src/lib/assistant/query.ts
 *
 * Turning a question ("how much did I spend on TfL this month?", "how much
 * do I owe him?") into a structured query the server can answer from the
 * user's own data. The AI (src/lib/assistant/ai.ts) does this when it is
 * available; `parseQuestion` below is the rule-based parser used otherwise,
 * and as a safety net. Answers are always computed from data, never by the AI.
 *
 * Pure module — no I/O.
 */

import { z } from "zod";

import { DEFAULT_CATEGORIES, DEFAULT_TAGS } from "@/lib/config";

export const INTENTS = ["spending", "owed", "savings", "plan", "wishlist", "help"] as const;
export type Intent = (typeof INTENTS)[number];

export const PERIOD_KEYS = [
  "today",
  "this_week",
  "this_month",
  "last_month",
  "last_30_days",
  "this_year",
  "last_year",
  "all_time",
] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];
/** A named period, or one calendar month ("month:2026-10"). */
export type Period = PeriodKey | `month:${string}`;

export const periodSchema = z.union([
  z.enum(PERIOD_KEYS),
  z.string().regex(/^month:\d{4}-(0[1-9]|1[0-2])$/) as z.ZodType<`month:${string}`>,
]);

export interface AssistantQuery {
  categoryId: string | null;
  direction: "i_owe" | "owed_to_me" | null;
  intent: Intent;
  /** Wishlist item to look up ("headphones"). */
  item: string | null;
  period: Period;
  /** A person's name, or "PREVIOUS" for him/her/them. */
  person: string | null;
  /** Shop / keyword to search descriptions and places for ("tfl"). */
  search: string | null;
}

/** What the last answer was about, so follow-ups like "and last month?" or "him" work. */
export const contextSchema = z.strictObject({
  categoryId: z.string().max(8).nullish(),
  intent: z.enum(INTENTS).nullish(),
  period: periodSchema.nullish(),
  person: z.string().max(60).nullish(),
  search: z.string().max(60).nullish(),
});
export type AssistantContext = z.infer<typeof contextSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Periods
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_SHORT = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const pad = (n: number) => String(n).padStart(2, "0");
const key = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (k: string) => new Date(`${k}T00:00:00Z`);
const addDays = (k: string, n: number) => {
  const d = parse(k);
  d.setUTCDate(d.getUTCDate() + n);
  return key(d);
};
const monthBounds = (year: number, month0: number) => {
  const first = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  return { from: key(first), to: key(last) };
};
const monthName = (year: number, month0: number) =>
  `${MONTHS[month0][0].toUpperCase()}${MONTHS[month0].slice(1)} ${year}`;

export interface ResolvedPeriod {
  from: string;
  /** e.g. "this month", "in October 2026". */
  label: string;
  /** The equivalent earlier period, for "more/less than…" comparisons. */
  previous: { from: string; label: string; to: string } | null;
  to: string;
}

/** Inclusive YYYY-MM-DD range for `period`, relative to `today`. */
export function resolvePeriod(period: Period, today: string): ResolvedPeriod {
  const t = parse(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const d = t.getUTCDate();

  if (period.startsWith("month:")) {
    const [py, pm] = period.slice(6).split("-").map(Number);
    const prev = new Date(Date.UTC(py, pm - 2, 1));
    return {
      ...monthBounds(py, pm - 1),
      label: `in ${monthName(py, pm - 1)}`,
      previous: { ...monthBounds(prev.getUTCFullYear(), prev.getUTCMonth()), label: monthName(prev.getUTCFullYear(), prev.getUTCMonth()) },
    };
  }

  switch (period as PeriodKey) {
    case "today":
      return { from: today, label: "today", previous: { from: addDays(today, -1), label: "yesterday", to: addDays(today, -1) }, to: today };
    case "this_week": {
      const monday = addDays(today, -((t.getUTCDay() + 6) % 7));
      return {
        from: monday,
        label: "this week",
        previous: { from: addDays(monday, -7), label: "the same point last week", to: addDays(today, -7) },
        to: today,
      };
    }
    case "last_month": {
      const lm = new Date(Date.UTC(y, m - 1, 1));
      const before = new Date(Date.UTC(y, m - 2, 1));
      return {
        ...monthBounds(lm.getUTCFullYear(), lm.getUTCMonth()),
        label: `last month (${monthName(lm.getUTCFullYear(), lm.getUTCMonth())})`,
        previous: { ...monthBounds(before.getUTCFullYear(), before.getUTCMonth()), label: monthName(before.getUTCFullYear(), before.getUTCMonth()) },
      };
    }
    case "last_30_days":
      return {
        from: addDays(today, -29),
        label: "in the last 30 days",
        previous: { from: addDays(today, -59), label: "the 30 days before", to: addDays(today, -30) },
        to: today,
      };
    case "this_year":
      return {
        from: `${y}-01-01`,
        label: `this year (${y})`,
        previous: { from: `${y - 1}-01-01`, label: `the same point in ${y - 1}`, to: `${y - 1}-${pad(m + 1)}-${pad(Math.min(d, 28))}` },
        to: today,
      };
    case "last_year":
      return {
        from: `${y - 1}-01-01`,
        label: `last year (${y - 1})`,
        previous: { from: `${y - 2}-01-01`, label: String(y - 2), to: `${y - 2}-12-31` },
        to: `${y - 1}-12-31`,
      };
    case "all_time":
      return { from: "1900-01-01", label: "in total", previous: null, to: today };
    case "this_month":
    default: {
      const lm = new Date(Date.UTC(y, m - 1, 1));
      const lastDayPrev = new Date(Date.UTC(y, m, 0)).getUTCDate();
      return {
        from: `${y}-${pad(m + 1)}-01`,
        label: "this month",
        previous: {
          from: key(lm),
          label: "the same point last month",
          to: `${lm.getUTCFullYear()}-${pad(lm.getUTCMonth() + 1)}-${pad(Math.min(d, lastDayPrev))}`,
        },
        to: today,
      };
    }
  }
}

/** Finds a period in the question, or returns `fallback`. */
export function detectPeriod(question: string, today: string, fallback: Period): Period {
  const q = question.toLowerCase();
  if (/\btoday\b/.test(q)) return "today";
  if (/\bthis week\b/.test(q)) return "this_week";
  if (/\b(last|previous) month\b/.test(q)) return "last_month";
  if (/\b(last|past) 30 days\b/.test(q)) return "last_30_days";
  if (/\bthis year\b/.test(q)) return "this_year";
  if (/\blast year\b/.test(q)) return "last_year";
  if (/\b(all[- ]time|ever|in total|altogether|overall)\b/.test(q)) return "all_time";
  if (/\b(this month|so far)\b/.test(q)) return "this_month";

  const t = parse(today);
  const month = q.match(/\b(?:in|during|for|of|since)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/);
  if (month) {
    const word = month[1].slice(0, 3);
    const m0 = MONTH_SHORT.indexOf(word === "sep" ? "sep" : word);
    if (m0 >= 0) {
      const year = m0 <= t.getUTCMonth() ? t.getUTCFullYear() : t.getUTCFullYear() - 1;
      return `month:${year}-${pad(m0 + 1)}`;
    }
  }
  return fallback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories and search terms
// ─────────────────────────────────────────────────────────────────────────────

/** Words people use for each category (ids match src/lib/config.ts). */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  "1": ["grocery", "groceries", "supermarket", "food shopping", "food shop"],
  "2": ["takeout", "takeaway", "takeaways", "eating out", "restaurants", "restaurant", "food delivery", "coffee"],
  "3": ["misc", "miscellaneous", "other stuff"],
  "4": ["shopping", "clothes", "clothing", "shoes"],
  "5": ["travel", "trips", "holidays", "holiday", "flights", "trains", "transport"],
  "6": ["gifts", "presents", "gift"],
  "7": ["petrol", "fuel"],
  "8": ["utilities", "bills", "energy", "electricity", "broadband"],
  "9": ["car", "car costs", "car insurance"],
};

export const categoryFromText = (text: string): string | null => {
  const q = ` ${text.toLowerCase().trim()} `;
  for (const [id, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (aliases.some((a) => q.includes(` ${a} `) || q.trim() === a)) return id;
  }
  const byName = DEFAULT_CATEGORIES.find((c) => q.trim() === c.name.toLowerCase());
  return byName?.id ?? null;
};

const STOP_TERMS = new Set([
  "it", "that", "this", "them", "stuff", "things", "everything", "anything", "total", "average", "me", "my",
  "month", "week", "year", "today", "average", "money",
]);

const TAG_NAMES = DEFAULT_TAGS.map((t) => t.name.toLowerCase());

/** The shop/keyword being asked about, in the user's own spelling ("TfL"). */
export function extractSearch(question: string): string | null {
  const original = question.trim();
  const q = original.toLowerCase();
  const patterns = [
    /\b(?:on|at|for|from)\s+(?:the\s+|my\s+)?([a-z0-9&'’.\- ]{2,40}?)(?=\s+(?:this|last|in|during|today|so far|since|over|ever|all|altogether|overall|per|each|a month|every)\b|\s*[?.!,]|\s*$)/,
    /\b([a-z0-9&'’.\-]{2,30})\s+(?:spending|costs?|expenses?|purchases)\b/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(q);
    const term = match?.[1]?.trim();
    if (!term || STOP_TERMS.has(term) || /^(how|what|much|did|do|i)\b/.test(term)) continue;
    const start = q.indexOf(term);
    return original.slice(start, start + term.length).trim();
  }
  const tag = TAG_NAMES.find((t) => q.includes(t));
  return tag ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// People
// ─────────────────────────────────────────────────────────────────────────────

const NOT_NAMES = new Set(["me", "you", "i", "who", "anyone", "anybody", "everyone", "everybody", "people", "someone", "money", "the", "a", "much", "how"]);
const PRONOUNS = new Set(["him", "her", "them", "he", "she", "they"]);

/** "how much do I owe Sara" → "Sara"; "does he owe me" → "PREVIOUS". */
export function extractPerson(question: string): string | null {
  const q = question.toLowerCase();
  const patterns = [
    /\bdoes\s+([a-z][a-z'’\-]{1,30})\s+(?:still\s+)?owe\b/,
    /\b([a-z][a-z'’\-]{1,30})\s+owes\b/,
    /\bowes?\s+(?:to\s+)?([a-z][a-z'’\-]{1,30})\b/,
    /\b(?:from|to|with)\s+([a-z][a-z'’\-]{1,30})(?=\s*[?.!,]|\s*$)/,
    /\b(?:lent|borrowed from|paid back|pay back)\s+([a-z][a-z'’\-]{1,30})\b/,
    /\babout\s+([a-z][a-z'’\-]{1,30})(?=\s*[?.!,]|\s*$)/,
  ];
  for (const pattern of patterns) {
    const word = pattern.exec(q)?.[1];
    if (!word || NOT_NAMES.has(word)) continue;
    if (PRONOUNS.has(word)) return "PREVIOUS";
    const start = q.indexOf(word);
    const original = question.slice(start, start + word.length);
    return original.charAt(0).toUpperCase() + original.slice(1);
  }
  if (/\b(him|her|them|he|she|they)\b/.test(q)) return "PREVIOUS";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based parser
// ─────────────────────────────────────────────────────────────────────────────

const FOLLOW_UP = /^(and|what about|how about|and what about|same for|what's it|what is it)\b/i;

export function parseQuestion(question: string, today: string, context: AssistantContext = {}): AssistantQuery {
  const q = question.toLowerCase().trim();
  const base: AssistantQuery = {
    categoryId: null,
    direction: null,
    intent: "help",
    item: null,
    period: detectPeriod(q, today, "this_month"),
    person: null,
    search: null,
  };

  if (/^(hi|hello|hey|help)\b|\bwhat can (you|i)\b|\bhow do (i|you) use\b/.test(q)) return base;

  // Owed (lend & borrow)
  if (/\bowe[sd]?\b|\blent\b|\bborrow(ed)?\b|\bpay (me |him |her |them )?back\b|\bpaid me back\b|\bdebts?\b|\bsettled?\b/.test(q)) {
    const direction = /\b(do|did|should|must)\s+i\s+owe\b|\bi\s+owe\b|\bi\s+borrowed\b|\bowe to\b/.test(q)
      ? "i_owe"
      : /\bowes?\s+me\b|\bowe\s+me\b|\bowed to me\b|\bwho owes\b|\bpay me back\b|\bi\s+lent\b/.test(q)
        ? "owed_to_me"
        : null;
    return { ...base, direction, intent: "owed", period: "all_time", person: extractPerson(question) };
  }

  // Wishlist
  if (/\bafford\b|\bwish ?list\b|\bwant to buy\b|\bsav(e|ing) (up )?for (the|a|an|my)\b/.test(q)) {
    const item = /\b(?:afford|buy|for)\s+(?:the\s+|a\s+|an\s+|my\s+|new\s+)*([a-z0-9&'’\- ]{2,40}?)(?=\s+(?:now|this|next|yet|soon|today)\b|\s*[?.!,]|\s*$)/.exec(q)?.[1]?.trim() ?? null;
    return { ...base, intent: "wishlist", item: item && !STOP_TERMS.has(item) ? item : null };
  }

  // Plan (goals, salary, how much should I save)
  if (/\bgoals?\b|\bon track\b|\bplan\b|\blong[- ]term\b|\bsalary\b|\brent\b|\bincome\b|\bhow much (should|do|can|must) i (need to )?save\b|\bsave (each|per|every|a) month\b|\bnext month\b/.test(q)) {
    return { ...base, intent: "plan" };
  }

  // Savings this month
  if (/\bsav(ed|ing|ings)\b|\bleft\b|\bsafe to spend\b|\bremaining\b|\bhow much (money )?(do i have|have i got)\b/.test(q)) {
    return { ...base, intent: "savings" };
  }

  // Spending
  const search = extractSearch(question);
  const categoryId = categoryFromText(search ?? "") ?? categoryFromText(q);
  const looksLikeSpending = /\bspen[dt]|spending\b|\bcost|\bpaid\b|\bpay\b|\bbought\b|\bexpens/.test(q);
  // "on it" / "on that" refers to the previous subject.
  const refersBack = /\b(?:on|at|for)\s+(?:it|that|this|them)\b/.test(q) && context.intent === "spending";
  if (refersBack) {
    return { ...base, categoryId: context.categoryId ?? null, intent: "spending", search: context.search ?? null };
  }
  if (looksLikeSpending || search || categoryId) {
    return {
      ...base,
      categoryId,
      intent: "spending",
      search: categoryId ? null : search,
    };
  }

  // "and last month?" — same subject as before, new period
  if (context.intent && (FOLLOW_UP.test(q) || q.split(/\s+/).length <= 4)) {
    return {
      ...base,
      categoryId: context.categoryId ?? null,
      intent: context.intent,
      person: context.intent === "owed" ? (extractPerson(question) ?? "PREVIOUS") : null,
      search: context.search ?? null,
    };
  }

  return base;
}

/** Resolves "him / her / them" to the person from the previous answer. */
export function applyContext(query: AssistantQuery, context: AssistantContext): AssistantQuery {
  return query.person === "PREVIOUS" ? { ...query, person: context.person ?? null } : query;
}
