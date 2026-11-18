/**
 * src/lib/ai/provider.ts — one entry point for every AI call (server-side only).
 *
 * Picks the first configured provider:
 *   1. Pollinations — POLLINATIONS_API_KEY, a secret key (sk_…). Publishable
 *      keys (pk_…) are rejected by Pollinations for server requests, so they
 *      count as "not configured" here.
 *   2. Google Gemini — GOOGLE_GEMINI_API_KEY (free key from
 *      https://aistudio.google.com/apikey). Also reads receipt photos.
 *
 * Both return the same PollinationsResult shape, so callers (assistant,
 * insights, receipt scanning) don't care which one answered. Keys are only
 * sent in request headers and are never logged or returned.
 */

import {
  callPollinations,
  checkApiKey,
  DEFAULT_MODEL as POLLINATIONS_DEFAULT_MODEL,
  type PollinationsMessage,
  type PollinationsResult,
} from "@/lib/insights/pollinations";

export type AiProvider = "gemini" | "pollinations";

export const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

type Env = Record<string, string | undefined>;

/** Which provider will answer, or null when none is set up. */
export function activeProvider(env: Env = process.env): AiProvider | null {
  if (!checkApiKey(env.POLLINATIONS_API_KEY)) return "pollinations";
  if (env.GOOGLE_GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

/** Human-readable reason the AI is off (for logs and the status endpoint). */
export function notConfiguredReason(env: Env = process.env): string {
  const pollinations = checkApiKey(env.POLLINATIONS_API_KEY);
  return `${pollinations ?? ""} Set POLLINATIONS_API_KEY to a secret (sk_) key, or GOOGLE_GEMINI_API_KEY.`.trim();
}

export type AiCallOptions = {
  messages: readonly PollinationsMessage[];
  maxCompletionTokens?: number;
  timeoutMs?: number;
  /** Needs to read images (receipts): picks the vision model where it differs. */
  vision?: boolean;
  env?: Env;
  fetchImpl?: typeof fetch;
};

export async function callAI({
  env = process.env,
  fetchImpl = fetch,
  maxCompletionTokens = 1500,
  messages,
  timeoutMs = 20_000,
  vision = false,
}: AiCallOptions): Promise<PollinationsResult> {
  const provider = activeProvider(env);

  if (provider === "pollinations") {
    const model =
      (vision ? env.POLLINATIONS_VISION_MODEL?.trim() : undefined) ||
      env.POLLINATIONS_MODEL?.trim() ||
      POLLINATIONS_DEFAULT_MODEL;
    return callPollinations({ apiKey: env.POLLINATIONS_API_KEY, fetchImpl, maxCompletionTokens, messages, model, timeoutMs });
  }

  if (provider === "gemini") {
    return callGemini({
      apiKey: env.GOOGLE_GEMINI_API_KEY!.trim(),
      fetchImpl,
      maxCompletionTokens,
      messages,
      model: env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL,
      timeoutMs,
    });
  }

  return { message: notConfiguredReason(env), ok: false, reason: "not_configured" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gemini (REST, generateContent)
// ─────────────────────────────────────────────────────────────────────────────

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

/** "data:image/jpeg;base64,AAAA" → inline image part; anything else → null. */
function dataUrlPart(url: string): GeminiPart | null {
  const match = /^data:([\w/+.-]+);base64,([\s\S]+)$/.exec(url);
  return match ? { inlineData: { data: match[2], mimeType: match[1] } } : null;
}

/** OpenAI-style messages → Gemini systemInstruction + contents. */
export function toGeminiRequest(messages: readonly PollinationsMessage[], maxOutputTokens: number) {
  const system: string[] = [];
  const contents: { parts: GeminiPart[]; role: "user" }[] = [];

  for (const message of messages) {
    const parts: GeminiPart[] = [];
    if (typeof message.content === "string") {
      parts.push({ text: message.content });
    } else {
      for (const part of message.content) {
        if (part.type === "text") parts.push({ text: part.text });
        else {
          const image = dataUrlPart(part.image_url.url);
          if (image) parts.push(image);
        }
      }
    }
    if (message.role === "system") {
      system.push(...parts.flatMap((p) => ("text" in p ? [p.text] : [])));
    } else {
      contents.push({ parts, role: "user" });
    }
  }

  return {
    contents,
    generationConfig: {
      maxOutputTokens,
      responseMimeType: "application/json",
      // Answers are short JSON; "thinking" would only eat the token budget.
      thinkingConfig: { thinkingBudget: 0 },
    },
    ...(system.length ? { systemInstruction: { parts: [{ text: system.join("\n\n") }] } } : {}),
  };
}

export async function callGemini({
  apiKey,
  fetchImpl = fetch,
  maxCompletionTokens,
  messages,
  model,
  timeoutMs,
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  maxCompletionTokens: number;
  messages: readonly PollinationsMessage[];
  model: string;
  timeoutMs: number;
}): Promise<PollinationsResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const timedOut = (): PollinationsResult => ({
    message: `No response within ${Math.round(timeoutMs / 1000)} seconds.`,
    ok: false,
    reason: "timeout",
  });

  try {
    let response: Response;
    try {
      response = await fetchImpl(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
        body: JSON.stringify(toGeminiRequest(messages, maxCompletionTokens)),
        cache: "no-store",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        method: "POST",
        signal: controller.signal,
      });
    } catch {
      return controller.signal.aborted ? timedOut() : { message: "Could not reach the AI service.", ok: false, reason: "unavailable" };
    }

    if (!response.ok) {
      const status = response.status;
      const body = await response.text().catch(() => "");
      if (status === 401 || status === 403 || (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body))) {
        return { message: "The AI service rejected the API key.", ok: false, reason: "unauthorized", status };
      }
      if (status === 429) {
        const retry = Number(response.headers.get("retry-after"));
        return {
          message: "The AI service is rate limiting requests.",
          ok: false,
          reason: "rate_limited",
          retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : undefined,
          status,
        };
      }
      return {
        message: status >= 500 ? "The AI service is temporarily unavailable." : `The AI service returned HTTP ${status}.`,
        ok: false,
        reason: status >= 500 ? "unavailable" : "bad_response",
        status,
      };
    }

    const json = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: unknown }[] }; finishReason?: string }[];
      modelVersion?: string;
      promptFeedback?: { blockReason?: string };
    };
    if (json.promptFeedback?.blockReason || json.candidates?.[0]?.finishReason === "SAFETY") {
      return { message: "The AI service's safety filter blocked the request.", ok: false, reason: "blocked" };
    }
    const content = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("")
      .trim();
    if (!content) return { message: "The AI service returned an empty answer.", ok: false, reason: "bad_response" };
    return { content, model: json.modelVersion ?? model, ok: true };
  } catch {
    return controller.signal.aborted ? timedOut() : { message: "The AI service returned an unreadable answer.", ok: false, reason: "bad_response" };
  } finally {
    clearTimeout(timer);
  }
}
