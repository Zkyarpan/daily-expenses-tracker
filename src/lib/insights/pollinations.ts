/**
 * src/lib/insights/pollinations.ts
 *
 * Feature 7: minimal client for the Pollinations text API (server-side only).
 *
 * Per https://gen.pollinations.ai/docs (checked 2026-11-12):
 *  - POST https://gen.pollinations.ai/v1/chat/completions (OpenAI-compatible)
 *  - Authorization: Bearer <secret key>. Only secret keys (sk_) authenticate;
 *    publishable keys (pk_) are rejected with 401 since 1 November 2026.
 *  - Text is at choices[0].message.content.
 *  - Errors: 401 invalid key · 402 insufficient balance / key budget ·
 *    403 key lacks permission · 400 content_blocked · 429 rate limited
 *    (honour Retry-After) · 500/502/503 upstream failures.
 *
 * The key is passed in by the caller (read from process.env on the server),
 * sent only in the Authorization header, and never logged or returned.
 */

import type { InsightsFallbackReason } from "@/entities/Insights";

import type { ChatMessage } from "./prompt";

export const POLLINATIONS_URL = "https://gen.pollinations.ai/v1/chat/completions";
export const DEFAULT_MODEL = "openai/gpt-5.4-nano";
export const DEFAULT_TIMEOUT_MS = 20_000;

export type PollinationsResult =
  | { ok: true; content: string; model: string }
  | {
      ok: false;
      reason: Exclude<InsightsFallbackReason, "ungrounded" | "no_data">;
      status?: number;
      retryAfterSeconds?: number;
      /** Safe, non-secret explanation for logs/UI. */
      message: string;
    };

export type CallOptions = {
  apiKey: string | undefined;
  messages: ChatMessage[];
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/** Only secret keys can authenticate server requests. */
export function checkApiKey(apiKey: string | undefined): string | null {
  if (!apiKey || !apiKey.trim()) return "POLLINATIONS_API_KEY is not set on the server.";
  if (apiKey.startsWith("pk_")) {
    return "POLLINATIONS_API_KEY is a publishable (pk_) key; Pollinations requires a secret (sk_) key for server requests.";
  }
  return null;
}

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - Date.now()) / 1000));
};

export async function callPollinations({
  apiKey,
  fetchImpl = fetch,
  messages,
  model = DEFAULT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: CallOptions): Promise<PollinationsResult> {
  const keyProblem = checkApiKey(apiKey);
  if (keyProblem) return { message: keyProblem, ok: false, reason: "not_configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(POLLINATIONS_URL, {
      body: JSON.stringify({
        max_completion_tokens: 1500,
        messages,
        model,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timer);
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return aborted
      ? { message: `No response within ${Math.round(timeoutMs / 1000)} seconds.`, ok: false, reason: "timeout" }
      : { message: "Could not reach the AI service.", ok: false, reason: "unavailable" };
  }

  try {
    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => "");
      if (status === 401) return { message: "The AI service rejected the API key.", ok: false, reason: "unauthorized", status };
      if (status === 403) return { message: "The API key lacks permission for this model.", ok: false, reason: "unauthorized", status };
      if (status === 402) return { message: "The AI account has no remaining balance.", ok: false, reason: "insufficient_balance", status };
      if (status === 429) {
        return {
          message: "The AI service is rate limiting requests.",
          ok: false,
          reason: "rate_limited",
          retryAfterSeconds: parseRetryAfter(response.headers.get("retry-after")),
          status,
        };
      }
      if (status === 400 && /content_blocked/i.test(body)) {
        return { message: "The AI service's safety filter blocked the request.", ok: false, reason: "blocked", status };
      }
      if (status === 422) return { message: "The AI service's content policy blocked the request.", ok: false, reason: "blocked", status };
      return {
        message: status >= 500 ? "The AI service is temporarily unavailable." : `The AI service returned HTTP ${status}.`,
        ok: false,
        reason: status >= 500 ? "unavailable" : "bad_response",
        status,
      };
    }

    const json = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return { message: "The AI service returned an empty answer.", ok: false, reason: "bad_response", status: response.status };
    }
    return { content, model: json.model ?? model, ok: true };
  } catch (error) {
    const aborted = controller.signal.aborted || (error instanceof Error && error.name === "AbortError");
    return aborted
      ? { message: `No response within ${Math.round(timeoutMs / 1000)} seconds.`, ok: false, reason: "timeout" }
      : { message: "The AI service returned an unreadable answer.", ok: false, reason: "bad_response" };
  } finally {
    clearTimeout(timer);
  }
}
