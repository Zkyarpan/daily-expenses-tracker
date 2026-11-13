/**
 * src/lib/pdfStatement.ts
 *
 * Turns the text of a bank or card statement into expense rows.
 *
 *  - `buildStatementMessages` / `parseAITransactions`: prompt and response
 *    handling for an AI model (used with Pollinations, server-side).
 *  - `parseStatementText`: a rule-based reader used when no AI is available.
 *    It looks for lines that start with a date and contain a money amount.
 *    Bank layouts vary, so every result is shown for review before saving.
 *
 * Pure functions (no PDF library, no network), so they are unit-testable.
 */

import { DEFAULT_CATEGORIES, DEFAULT_TAGS, GEMINI_PDF_RULES } from "@/lib/config";

import type { ChatMessage } from "./insights/prompt";

export type StatementTransaction = {
  amount: number;
  categoryId: string;
  date: string; // YYYY-MM-DD
  description: string;
  tagId: string | null;
};

/** Longest statement text sent to the AI (characters). */
export const MAX_AI_TEXT = 60_000;

const MISC_CATEGORY_ID = "3";

const MONTHS: Record<string, number> = {
  apr: 4, aug: 8, dec: 12, feb: 2, jan: 1, jul: 7, jun: 6, mar: 3, may: 5, nov: 11, oct: 10, sep: 9, sept: 9,
};

// ── AI prompt ────────────────────────────────────────────────────────────────

export function buildStatementMessages(statementText: string): ChatMessage[] {
  const system = `You are a bank statement parser. Extract every spending transaction from the statement text.

${GEMINI_PDF_RULES.replace("9. Return ONLY the JSON array, nothing else", "9. Return ONLY the JSON object described below, nothing else")}

Available categories (use the id):
${DEFAULT_CATEGORIES.map((c) => `- ${c.name} (id: ${c.id})`).join("\n")}

Available tags (use the id, or null when none fits):
${DEFAULT_TAGS.map((t) => `- ${t.name} (id: ${t.id})`).join("\n")}

Respond with a JSON object of this exact shape:
{"transactions":[{"date":"YYYY-MM-DD","description":"Merchant name","amount":12.34,"categoryId":"1","tagId":null}]}
If the text contains no transactions, respond with {"transactions":[]}.`;

  return [
    { content: system, role: "system" },
    {
      content: `Statement text:\n"""\n${statementText.slice(0, MAX_AI_TEXT)}\n"""`,
      role: "user",
    },
  ];
}

const isISODate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Validates and normalises the AI's JSON. Returns null if it is unusable. */
export function parseAITransactions(content: string): StatementTransaction[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { transactions?: unknown })?.transactions)
      ? (parsed as { transactions: unknown[] }).transactions
      : null;
  if (!list) return null;

  const categoryIds = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
  const tagIds = new Set(DEFAULT_TAGS.map((t) => t.id));

  return list.flatMap((item) => {
    const t = item as Partial<Record<keyof StatementTransaction, unknown>>;
    const amount = typeof t.amount === "number" ? t.amount : parseFloat(String(t.amount));
    const date = String(t.date ?? "");
    if (!Number.isFinite(amount) || amount === 0 || !isISODate(date)) return [];
    const categoryId = categoryIds.has(String(t.categoryId)) ? String(t.categoryId) : MISC_CATEGORY_ID;
    const tagId = t.tagId != null && tagIds.has(String(t.tagId)) ? String(t.tagId) : null;
    return [
      {
        amount: Math.round(amount * 100) / 100,
        categoryId,
        date,
        description: String(t.description ?? "").trim().slice(0, 200),
        tagId,
      },
    ];
  });
}

// ── Rule-based reader ────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<[string, RegExp]> = [
  ["1", /\b(tesco|sainsbury|asda|aldi|lidl|morrisons|waitrose|co-?op|iceland|m&s food|ocado|grocer|supermarket|costco)\b/i],
  ["2", /\b(deliveroo|just ?eat|uber ?eats|mcdonald|kfc|nando|domino|pizza|burger|restaurant|cafe|costa|starbucks|pret|greggs|subway|takeaway)\b/i],
  ["7", /\b(shell|esso|texaco|bp\b|petrol|fuel|jet)\b/i],
  ["5", /\b(trainline|tfl|national rail|lner|avanti|ryanair|easyjet|british airways|airbnb|booking\.com|hotel|uber(?! ?eats)|bolt|travel)\b/i],
  ["8", /\b(british gas|edf|octopus|eon|e\.on|thames water|water|council tax|vodafone|\bee\b|o2|three|bt\b|sky|virgin media|netflix|spotify|electric|energy|broadband)\b/i],
  ["9", /\b(dvla|insurance|mot|garage|halfords|kwik ?fit|parking)\b/i],
  ["4", /\b(amazon|amzn|primark|h&m|zara|next|argos|ebay|asos|shein|john lewis|boots|ikea)\b/i],
  ["6", /\b(gift|flowers|moonpig|card factory)\b/i],
];

// Lines that are not spending: balances, totals, money in, transfers, card repayments.
const SKIP_PATTERN =
  /\b(balance|brought forward|carried forward|opening|closing|total|subtotal|payment received|payment thank you|direct credit|salary|wages|interest paid|transfer (?:from|to)|refund received|credit card payment|bill pay)\b/i;

const AMOUNT_PATTERN = /(-?)£?\s?(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})(\s?(?:CR|DR))?\b/gi;

function guessCategory(description: string): string {
  for (const [id, pattern] of CATEGORY_KEYWORDS) if (pattern.test(description)) return id;
  return MISC_CATEGORY_ID;
}

function guessTag(description: string): string | null {
  const lower = description.toLowerCase();
  const tag = DEFAULT_TAGS.find((t) => t.id !== "others" && lower.includes(t.name.toLowerCase()));
  return tag?.id ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toISO(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getMonth() !== month - 1) return null; // e.g. 31 Feb
  return `${year}-${pad(month)}-${pad(day)}`;
}

const fullYear = (y: number) => (y < 100 ? 2000 + y : y);

/** Finds a date at the start of the line. Returns the ISO date and the rest of the line. */
function readLeadingDate(line: string, defaultYear: number): { date: string; rest: string } | null {
  let m = line.match(/^(\d{4})-(\d{2})-(\d{2})\b\s*(.*)$/);
  if (m) {
    const date = toISO(+m[1], +m[2], +m[3]);
    return date ? { date, rest: m[4] } : null;
  }

  m = line.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b\s*(.*)$/);
  if (m) {
    // UK order: day/month/year
    const date = toISO(fullYear(+m[3]), +m[2], +m[1]);
    return date ? { date, rest: m[4] } : null;
  }

  m = line.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(?:(\d{4}|\d{2})\b\s*)?(.*)$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith("sept") ? 4 : 3)];
    if (!month) return null;
    const date = toISO(m[3] ? fullYear(+m[3]) : defaultYear, month, +m[1]);
    return date ? { date, rest: m[4] } : null;
  }

  return null;
}

/** The year most often written in the statement (used for "12 Nov" style dates). */
function inferYear(text: string, fallback: number): number {
  const counts = new Map<number, number>();
  for (const match of text.matchAll(/\b(20\d{2})\b/g)) {
    const y = +match[1];
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best = fallback;
  let bestCount = 0;
  counts.forEach((count, year) => {
    if (count > bestCount) {
      best = year;
      bestCount = count;
    }
  });
  return best;
}

/**
 * Rule-based statement reader. For each line that starts with a date and
 * contains at least one money amount, the first amount is taken as the
 * transaction (a trailing amount is usually the running balance).
 */
export function parseStatementText(text: string, today = new Date()): StatementTransaction[] {
  const year = inferYear(text, today.getFullYear());
  const results: StatementTransaction[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 8) continue;

    const dated = readLeadingDate(line, year);
    if (!dated) continue;

    const amounts = [...dated.rest.matchAll(AMOUNT_PATTERN)];
    if (amounts.length === 0) continue;

    const first = amounts[0];
    const isCredit = /CR/i.test(first[4] ?? "");
    const description = dated.rest
      .slice(0, first.index)
      .replace(/[£$]/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—:|]+|[\s\-–—:|]+$/g, "")
      .trim();

    if (!description || isCredit || SKIP_PATTERN.test(description)) continue;

    const amount = parseFloat(`${first[2].replace(/,/g, "")}.${first[3]}`);
    if (!Number.isFinite(amount) || amount === 0) continue;

    results.push({
      amount,
      categoryId: guessCategory(description),
      date: dated.date,
      description: description.slice(0, 200),
      tagId: guessTag(description),
    });
  }

  return results;
}
