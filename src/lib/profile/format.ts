/**
 * src/lib/profile/format.ts
 *
 * Pure helpers for the profile backend: privacy-preserving labels for the
 * activity log and the CSV export. No I/O, so they are unit tested directly.
 */

import { toCsv } from "@/lib/analytics";
import { DEFAULT_CATEGORIES, DEFAULT_MEMBERS, DEFAULT_TAGS } from "@/lib/config";

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

/**
 * Coarse "Browser on OS" label for the activity log. The raw user agent and
 * the IP address are deliberately not stored.
 */
export function deviceLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null;
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}

/**
 * 0–4 strength score for the password meter: 0 below the minimum length,
 * then a point each for ≥ 12 characters, mixed case, digits and symbols.
 */
export function passwordStrength(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(4, score);
}

/** "jane.doe@example.com" → "j*******@example.com" (for activity details). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  return `${local[0]}${"*".repeat(Math.min(Math.max(local.length - 1, 1), 7))}${email.slice(at)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV export
// ─────────────────────────────────────────────────────────────────────────────

export type ExportRow = {
  amount: number | string;
  categoryId: string | null;
  date: string;
  description: string | null;
  memberId: string | null;
  tagId: string | null;
};

const names = (items: { id: string; name: string }[]) => new Map(items.map((i) => [i.id, i.name]));
const CATEGORY = names(DEFAULT_CATEGORIES);
const TAG = names(DEFAULT_TAGS);
const MEMBER = names(DEFAULT_MEMBERS);

export const EXPORT_HEADERS = ["Date", "Description", "Category", "Merchant / place", "Paid by", "Amount (GBP)"] as const;

/**
 * All of a user's expenses as CSV, oldest first. Cells are escaped (and
 * spreadsheet formulas neutralised) by toCsv.
 */
export function buildExpensesCsv(rows: readonly ExportRow[]): string {
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return toCsv(
    EXPORT_HEADERS,
    sorted.map((e) => [
      String(e.date).slice(0, 10),
      e.description ?? "",
      (e.categoryId && CATEGORY.get(e.categoryId)) || "Uncategorized",
      (e.tagId && TAG.get(e.tagId)) || "",
      (e.memberId && MEMBER.get(e.memberId)) || "",
      Number(Number(e.amount).toFixed(2)),
    ]),
  );
}
