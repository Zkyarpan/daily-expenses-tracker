/**
 * tests/engagement.test.ts
 *
 *  1. Spending alerts: big spend, busy day, category past last month, pace, weekly recap
 *  2. Help panel: how-to questions → built-in topics; money questions → assistant
 *  3. AI provider: which one is used, Gemini request shape, error mapping
 *
 * Run: node_modules/.bin/tsx --test tests/engagement.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { activeProvider, callAI, toGeminiRequest } from "../src/lib/ai/provider.js";
import { matchTopic } from "../src/lib/help/topics.js";
import { type SignalExpense, spendingSignals } from "../src/lib/onboarding/spendingSignals.js";

let n = 0;
const e = (date: string, amount: number, categoryName = "Grocery", description = "Shop"): SignalExpense => ({
  amount,
  categoryName,
  date,
  description,
  id: `e${++n}`,
});

/** Ten ordinary £10–£20 expenses across October. */
const october = Array.from({ length: 10 }, (_, i) => e(`2026-10-${String(i + 2).padStart(2, "0")}`, 10 + i, "Grocery"));

describe("spending alerts", () => {
  it("flags a recent expense far above the usual size", () => {
    const today = new Date(2026, 10, 18, 12);
    const signals = spendingSignals({
      lastMonth: october,
      thisMonth: [e("2026-11-03", 15), e("2026-11-17", 420, "Shopping", "New phone")],
      today,
    });
    const big = signals.find((s) => s.id.startsWith("big:"));
    assert.ok(big, "expected a big-spend alert");
    assert.match(big.title, /£420\.00 on Shopping/);
    assert.equal(signals[0].id, big.id, "big spend is the most important");
  });

  it("ignores an old big expense (more than two days ago)", () => {
    const signals = spendingSignals({
      lastMonth: october,
      thisMonth: [e("2026-11-02", 420, "Shopping")],
      today: new Date(2026, 10, 18, 12),
    });
    assert.equal(signals.some((s) => s.id.startsWith("big:")), false);
  });

  it("flags a busy day against the usual daily spend", () => {
    const signals = spendingSignals({
      lastMonth: october,
      thisMonth: [e("2026-11-05", 12), e("2026-11-18", 60), e("2026-11-18", 45)],
      today: new Date(2026, 10, 18, 12),
    });
    assert.ok(signals.some((s) => s.id === "day:2026-11-18"));
  });

  it("flags a category that has passed all of last month", () => {
    const signals = spendingSignals({
      lastMonth: [...october, e("2026-10-20", 40, "Takeout")],
      thisMonth: [e("2026-11-04", 30, "Takeout"), e("2026-11-10", 25, "Takeout")],
      today: new Date(2026, 10, 12, 12),
    });
    const cat = signals.find((s) => s.id === "cat:2026-11:Takeout");
    assert.ok(cat);
    assert.match(cat.title, /Takeout: already more than all of October/);
  });

  it("warns about a high monthly pace and praises a low one", () => {
    const high = spendingSignals({
      lastMonth: october, // £145
      thisMonth: [e("2026-11-03", 90), e("2026-11-08", 80)],
      today: new Date(2026, 10, 10, 12),
    });
    assert.ok(high.some((s) => s.id === "pace-high:2026-11" && s.tone === "warning"));

    const low = spendingSignals({
      lastMonth: [...october, e("2026-10-25", 500, "Car")],
      thisMonth: [e("2026-11-03", 40), e("2026-11-12", 30)],
      today: new Date(2026, 10, 20, 12),
    });
    assert.ok(low.some((s) => s.id === "pace-low:2026-11" && s.tone === "success"));
  });

  it("gives a weekly recap on Mondays only", () => {
    const thisMonth = [e("2026-11-11", 20, "Takeout"), e("2026-11-14", 35, "Grocery")];
    const monday = spendingSignals({ lastMonth: october, thisMonth, today: new Date(2026, 10, 16, 12) });
    assert.ok(monday.some((s) => s.id === "week:2026-11-16"));
    const tuesday = spendingSignals({ lastMonth: october, thisMonth, today: new Date(2026, 10, 17, 12) });
    assert.equal(tuesday.some((s) => s.id.startsWith("week:")), false);
  });

  it("stays quiet with no data", () => {
    assert.deepEqual(spendingSignals({ lastMonth: [], thisMonth: [], today: new Date(2026, 10, 18) }), []);
  });
});

describe("help panel matching", () => {
  it("answers how-to questions from the built-in topics", () => {
    assert.equal(matchTopic("How do I import a bank statement?")?.id, "import");
    assert.equal(matchTopic("how do budgets work")?.id, "budgets");
    assert.equal(matchTopic("Is my data private?")?.id, "privacy");
    assert.equal(matchTopic("scan a receipt")?.id, "receipt");
  });

  it("leaves questions about the user's own figures to the assistant", () => {
    assert.equal(matchTopic("How much did I spend on takeout this month?"), null);
    assert.equal(matchTopic("Who owes me money?"), null);
  });
});

describe("AI provider", () => {
  it("prefers a Pollinations secret key, then Gemini, and ignores pk_ keys", () => {
    assert.equal(activeProvider({ POLLINATIONS_API_KEY: "sk_abc" }), "pollinations");
    assert.equal(activeProvider({ GOOGLE_GEMINI_API_KEY: "g", POLLINATIONS_API_KEY: "pk_abc" }), "gemini");
    assert.equal(activeProvider({ POLLINATIONS_API_KEY: "pk_abc" }), null);
    assert.equal(activeProvider({}), null);
  });

  it("reports not_configured without calling the network", async () => {
    const result = await callAI({
      env: { POLLINATIONS_API_KEY: "pk_x" },
      fetchImpl: () => Promise.reject(new Error("should not be called")),
      messages: [{ content: "hi", role: "user" }],
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.reason, "not_configured");
  });

  it("builds a Gemini request with system text, images and JSON output", () => {
    const request = toGeminiRequest(
      [
        { content: "Be brief.", role: "system" },
        {
          content: [
            { text: "Read this", type: "text" },
            { image_url: { url: "data:image/jpeg;base64,QUJD" }, type: "image_url" },
          ],
          role: "user",
        },
      ],
      300,
    );
    assert.deepEqual(request.systemInstruction, { parts: [{ text: "Be brief." }] });
    assert.deepEqual(request.contents[0].parts[1], { inlineData: { data: "QUJD", mimeType: "image/jpeg" } });
    assert.equal(request.generationConfig.responseMimeType, "application/json");
    assert.equal(request.generationConfig.maxOutputTokens, 300);
  });

  it("returns Gemini's text and maps errors", async () => {
    const ok = await callAI({
      env: { GOOGLE_GEMINI_API_KEY: "key" },
      fetchImpl: async (_url, init) => {
        assert.equal((init?.headers as Record<string, string>)["x-goog-api-key"], "key");
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), {
          status: 200,
        });
      },
      messages: [{ content: "hi", role: "user" }],
    });
    assert.deepEqual(ok.ok && ok.content, '{"ok":true}');

    const limited = await callAI({
      env: { GOOGLE_GEMINI_API_KEY: "key" },
      fetchImpl: async () => new Response("{}", { headers: { "retry-after": "30" }, status: 429 }),
      messages: [{ content: "hi", role: "user" }],
    });
    assert.equal(!limited.ok && limited.reason, "rate_limited");

    const badKey = await callAI({
      env: { GOOGLE_GEMINI_API_KEY: "key" },
      fetchImpl: async () => new Response('{"error":{"status":"INVALID_ARGUMENT","message":"API key not valid"}}', { status: 400 }),
      messages: [{ content: "hi", role: "user" }],
    });
    assert.equal(!badKey.ok && badKey.reason, "unauthorized");
  });
});
