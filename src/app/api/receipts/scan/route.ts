/**
 * POST /api/receipts/scan — read a receipt photo into an expense draft.
 *
 *   body: { image: "data:image/jpeg;base64,…" }  →  { receipt: ReceiptDraft }
 *
 * Security and privacy
 *  - Signed-in users only; same-origin JSON; per-user rate limit.
 *  - The image must really be JPEG/PNG/WebP (checked by its bytes) and ≤ 4 MB.
 *    The browser already downsizes it and re-encodes it, which strips EXIF
 *    metadata such as GPS location.
 *  - The photo is sent to the AI service only to read it, and is never
 *    stored or logged here. Nothing is saved: the user reviews the draft and
 *    saves the expense themselves.
 *  - Text in the photo is treated as data (prompt-injection guard in the
 *    prompt), and every value returned is re-validated.
 */

import { z } from "zod";

import { callPollinations, DEFAULT_MODEL } from "@/lib/insights/pollinations";
import { createRateLimiter } from "@/lib/insights/rateLimit";
import { resolveToday } from "@/lib/money/server";
import { buildReceiptMessages, parseImageDataUrl, parseReceiptContent } from "@/lib/receipts/receipt";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 10 scans per 10 minutes, at least 3 s apart. */
const limiter = createRateLimiter({ limit: 10, minIntervalMs: 3_000, windowMs: 10 * 60_000 });

const bodySchema = z.strictObject({ image: z.string().min(100).max(6_000_000) });

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "You’re scanning quickly — please wait a moment and try again.");

  const body = await readJsonBody(request, bodySchema, 6_000_000);
  if ("response" in body) return body.response;

  const image = parseImageDataUrl(body.data.image);
  if ("error" in image) return apiError(400, image.error, { field: "image" });

  const today = resolveToday(request);
  const result = await callPollinations({
    apiKey: process.env.POLLINATIONS_API_KEY,
    maxCompletionTokens: 800,
    messages: buildReceiptMessages(body.data.image, today),
    model: process.env.POLLINATIONS_VISION_MODEL?.trim() || process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: 45_000,
  });

  if (!result.ok) {
    if (result.reason === "not_configured") {
      return apiError(503, "Receipt scanning needs the AI service, which isn’t configured. You can still add the expense by hand.");
    }
    if (result.reason === "rate_limited") {
      return apiError(429, "The AI service is busy. Please try again in a minute.", { retryAfterSeconds: result.retryAfterSeconds });
    }
    console.warn("[receipts] scan failed:", result.reason, result.status ?? "");
    return apiError(502, "The receipt couldn’t be read right now. Try again, or add the expense by hand.");
  }

  const parsed = parseReceiptContent(result.content, today);
  if (!parsed.ok) return apiError(422, parsed.message);
  return apiJson({ receipt: parsed.draft });
}
