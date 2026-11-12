/**
 * src/lib/insights/grounding.ts
 *
 * Feature 7: verifies that AI text only quotes figures that exist in the
 * calculated InsightsSummary. Every "£…" amount and "…%" percentage in the
 * text must match a number in the summary (allowing the AI to round to whole
 * pounds/percent). Anything else is treated as invented and rejected.
 */

import type { InsightsSummary } from "@/entities/Insights";

export type AllowedNumbers = { values: number[] };

/** Every number in the summary (and its absolute value), for matching. */
export function allowedNumbers(summary: InsightsSummary): AllowedNumbers {
  const values = new Set<number>();
  const walk = (v: unknown) => {
    if (typeof v === "number" && Number.isFinite(v)) {
      values.add(v);
      values.add(Math.abs(v));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v).forEach(walk);
    }
  };
  walk(summary);
  return { values: Array.from(values) };
}

export type Figure = { kind: "money" | "percent"; value: number; raw: string };

const MONEY_RE = /£\s?(-?\d[\d,]*(?:\.\d+)?)\s?(k|m)?\b/gi;
const PERCENT_RE = /(-?\d[\d,]*(?:\.\d+)?)\s?%/g;

/** All £ amounts and percentages quoted in a piece of text. */
export function extractFigures(text: string): Figure[] {
  const figures: Figure[] = [];
  for (const m of text.matchAll(MONEY_RE)) {
    const scale = m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1;
    figures.push({ kind: "money", raw: m[0], value: Number(m[1].replace(/,/g, "")) * scale });
  }
  for (const m of text.matchAll(PERCENT_RE)) {
    figures.push({ kind: "percent", raw: m[0], value: Number(m[1].replace(/,/g, "")) });
  }
  return figures;
}

/**
 * A quoted figure matches a summary value if it is the same to the penny /
 * 0.1%, or it is that value rounded to a whole number (£45 for £45.20). A
 * compact figure such as "£1.2k" matches within its stated precision.
 */
const matches = (figure: Figure, value: number): boolean => {
  const x = figure.value;
  if (Math.abs(x - value) <= 0.005) return true;
  if (Number.isInteger(x) && (Math.round(value) === x || Math.trunc(value) === x)) return true;
  if (figure.kind === "percent" && Math.abs(x - value) <= 0.05) return true;
  if (/k\b/i.test(figure.raw) && Math.abs(x - value) <= 50) return true;
  return false;
};

/** Figures in `text` that do not appear in the summary. */
export function ungroundedFigures(text: string, allowed: AllowedNumbers): Figure[] {
  return extractFigures(text).filter(
    (f) => !Number.isFinite(f.value) || !allowed.values.some((v) => matches(f, Math.abs(v)) || matches(f, v)),
  );
}

export const isGrounded = (text: string, allowed: AllowedNumbers): boolean =>
  ungroundedFigures(text, allowed).length === 0;
