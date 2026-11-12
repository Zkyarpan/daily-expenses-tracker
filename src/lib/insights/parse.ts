/**
 * src/lib/insights/parse.ts
 *
 * Feature 7: turns the AI's raw text into validated insights.
 *  1. Extract JSON (tolerating ```json fences or text around it).
 *  2. Validate the shape with zod; trim over-long text.
 *  3. Drop any insight that quotes a figure not present in the summary.
 *  4. Require at least MIN_INSIGHTS grounded insights, else report failure
 *     so the caller can use the deterministic summary instead.
 */

import { z } from "zod";

import type { Insight, InsightsSummary } from "@/entities/Insights";

import { allowedNumbers, isGrounded } from "./grounding";
import { MAX_INSIGHTS, MIN_INSIGHTS } from "./prompt";

const clip = (max: number) => (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

const insightSchema = z.object({
  detail: z.string().min(1).transform(clip(320)),
  kind: z.enum(["risk", "saving", "trend", "positive"]).catch("trend"),
  title: z.string().min(1).transform(clip(80)),
});

const responseSchema = z.object({
  headline: z.string().min(1).transform(clip(180)),
  insights: z.array(z.unknown()).min(1),
});

export type ParseResult =
  | { ok: true; headline: string | null; insights: Insight[]; dropped: number }
  | { ok: false; reason: "bad_response" | "ungrounded"; detail: string };

/** First top-level JSON object in the text, if any. */
export function extractJsonObject(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found");
  return JSON.parse(unfenced.slice(start, end + 1));
}

export function parseInsightsContent(content: string, summary: InsightsSummary): ParseResult {
  let json: unknown;
  try {
    json = extractJsonObject(content);
  } catch {
    return { detail: "Response was not valid JSON", ok: false, reason: "bad_response" };
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    return { detail: "Response JSON had the wrong shape", ok: false, reason: "bad_response" };
  }

  const items = parsed.data.insights
    .map((i) => insightSchema.safeParse(i))
    .filter((r) => r.success)
    .map((r) => r.data as Insight);

  const allowed = allowedNumbers(summary);
  const grounded = items.filter((i) => isGrounded(`${i.title} ${i.detail}`, allowed));
  const dropped = items.length - grounded.length;

  if (grounded.length < MIN_INSIGHTS) {
    return {
      detail: `Only ${grounded.length} usable insights (${dropped} quoted figures not in your data)`,
      ok: false,
      reason: dropped > 0 ? "ungrounded" : "bad_response",
    };
  }

  const headline = isGrounded(parsed.data.headline, allowed) ? parsed.data.headline : null;
  return { dropped, headline, insights: grounded.slice(0, MAX_INSIGHTS), ok: true };
}
