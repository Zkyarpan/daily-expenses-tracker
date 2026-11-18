/**
 * tests/insights.test.ts
 *
 * Unit tests for Feature 7: AI-Powered Spending Insights.
 *
 *  1. buildInsightsSummary — aggregation, trend, year boundary, budgets, projections, empty data
 *  2. Data privacy — no descriptions, tags, members, IDs, emails or user IDs reach the AI
 *  3. Grounding — figures quoted by the AI must exist in the summary
 *  4. parseInsightsContent — JSON extraction, validation, trimming, ungrounded insights
 *  5. Deterministic fallback — always grounded, 3–5 items, risk ordering
 *  6. callPollinations — request format, key handling, every failure mode, timeout
 *  7. Rate limiter — min interval, rolling window, per-user isolation, expiry
 *  8. generateInsights — end-to-end orchestration with an injected AI
 *
 * Run: node_modules/.bin/tsx --test tests/insights.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { InsightsSummary } from "../src/entities/Insights.js";
import type { AnalyticsBudget } from "../src/lib/analytics.js";
import { buildFallbackHeadline, buildFallbackInsights } from "../src/lib/insights/fallback.js";
import { generateInsights } from "../src/lib/insights/generate.js";
import { allowedNumbers, extractFigures, isGrounded, ungroundedFigures } from "../src/lib/insights/grounding.js";
import { extractJsonObject, parseInsightsContent } from "../src/lib/insights/parse.js";
import {
  callPollinations,
  checkApiKey,
  DEFAULT_MODEL,
  POLLINATIONS_URL,
} from "../src/lib/insights/pollinations.js";
import { buildInsightsMessages, type ChatMessage } from "../src/lib/insights/prompt.js";
import { createRateLimiter } from "../src/lib/insights/rateLimit.js";
import { buildInsightsSummary, insightsDateRange } from "../src/lib/insights/summary.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const NAMES: Record<string, string> = { "1": "Grocery", "2": "Takeout", "4": "Shopping", uncategorized: "Uncategorized" };
const nameOf = (k: string) => NAMES[k] ?? k;

let seq = 0;
/** Expense rows shaped like DB rows, including private fields that must never leak. */
const row = (date: string, amount: number, categoryId: string | null = "1") => ({
  amount,
  categoryId,
  date,
  description: `SECRET-MERCHANT-${++seq} paid by jane.doe@example.com`,
  id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
  memberId: "member-anoosha",
  tagId: "tag-costco",
  user_id: "11111111-2222-4333-8444-555555555555",
});

const budget = (month: number, categoryId: string, limitAmount: number, year = 2026): AnalyticsBudget => ({
  categoryId,
  limitAmount,
  month,
  year,
});

// November 2026 (month 11), with history back to June and a December 2025 row.
const EXPENSES = [
  row("2026-11-03", 120.5, "1"),
  row("2026-11-08", 80.25, "1"),
  row("2026-11-09", 60, "2"),
  row("2026-11-10", 15.75, null),
  row("2026-10-04", 150, "1"),
  row("2026-10-20", 40, "2"),
  row("2026-09-12", 200, "4"),
  row("2026-06-01", 90, "1"),
  row("2026-05-31", 999, "1"), // outside the 6-month trend window
];
const TODAY_MID_NOV = new Date(2026, 10, 12); // 12 Nov 2026
const AFTER_NOV = new Date(2026, 11, 15);

const summaryFor = (opts: Partial<Parameters<typeof buildInsightsSummary>[0]> = {}) =>
  buildInsightsSummary({
    budgets: [budget(11, "1", 250), budget(11, "2", 50)],
    expenses: EXPENSES,
    month: 11,
    nameOf,
    today: AFTER_NOV,
    year: 2026,
    ...opts,
  });

// ─────────────────────────────────────────────────────────────────────────────
// 1. Aggregation
// ─────────────────────────────────────────────────────────────────────────────

describe("buildInsightsSummary — aggregation", () => {
  it("totals reconcile with the month's records", () => {
    const s = summaryFor();
    assert.equal(s.totals.spending, 276.5); // 120.5 + 80.25 + 60 + 15.75
    assert.equal(s.totals.transactions, 4);
    assert.equal(s.totals.averageTransaction, 69.13);
    assert.equal(s.period.label, "November 2026");
  });

  it("category totals add up to the month total and are sorted", () => {
    const s = summaryFor();
    assert.deepEqual(s.categories.map((c) => c.category), ["Grocery", "Takeout", "Uncategorized"]);
    const sum = s.categories.reduce((p, c) => p + Math.round(c.total * 100), 0) / 100;
    assert.equal(sum, s.totals.spending);
    assert.equal(s.categories[0].sharePct, 72.6);
  });

  it("compares with the previous month overall and per category", () => {
    const s = summaryFor();
    assert.equal(s.totals.previousMonthSpending, 190);
    assert.equal(s.totals.changeVsPreviousMonth, 86.5);
    assert.equal(s.totals.changeVsPreviousMonthPct, 45.5);
    const grocery = s.categories.find((c) => c.category === "Grocery")!;
    assert.equal(grocery.previousMonthTotal, 150);
    assert.equal(grocery.changePct, 33.8); // (200.75 − 150) / 150
    assert.equal(s.categories.find((c) => c.category === "Uncategorized")!.changePct, null);
  });

  it("builds a 6-month trend ending in the selected month", () => {
    const s = summaryFor();
    assert.deepEqual(
      s.monthlyTrend.map((m) => m.month),
      ["Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026", "Oct 2026", "Nov 2026"],
    );
    assert.deepEqual(s.monthlyTrend.map((m) => m.total), [90, 0, 0, 200, 190, 276.5]);
    // Average of prior months that had spending: (90 + 200 + 190) / 3
    assert.equal(s.totals.priorMonthsAverage, 160);
  });

  it("insightsDateRange covers six whole months", () => {
    const r = insightsDateRange(2026, 11);
    assert.equal(r.start.getMonth(), 5);
    assert.equal(r.start.getDate(), 1);
    assert.equal(r.end.getDate(), 30);
  });

  it("January compares with the previous December (year boundary)", () => {
    const s = buildInsightsSummary({
      budgets: null,
      expenses: [row("2025-12-31", 50), row("2026-01-01", 75)],
      month: 1,
      nameOf,
      today: new Date(2026, 1, 1),
      year: 2026,
    });
    assert.equal(s.totals.spending, 75);
    assert.equal(s.totals.previousMonthSpending, 50);
    assert.equal(s.monthlyTrend[0].month, "Aug 2025");
    assert.equal(s.monthlyTrend[4].total, 50); // Dec 2025
  });

  it("budget rows use the alert thresholds and report remaining amounts", () => {
    const s = summaryFor();
    const grocery = s.budgets!.rows.find((r) => r.category === "Grocery")!;
    assert.equal(grocery.spent, 200.75);
    assert.equal(grocery.remaining, 49.25);
    assert.equal(grocery.utilisationPct, 80.3);
    assert.equal(grocery.status, "warning");
    const takeout = s.budgets!.rows.find((r) => r.category === "Takeout")!;
    assert.equal(takeout.status, "over");
    assert.equal(takeout.remaining, -10);
    assert.equal(s.budgets!.totalLimit, 300);
    assert.equal(s.budgets!.totalSpent, 260.75);
  });

  it("projections exist only for the current month", () => {
    const past = summaryFor();
    assert.equal(past.period.isCurrentMonth, false);
    assert.equal(past.totals.projectedMonthEnd, null);
    assert.ok(past.budgets!.rows.every((r) => r.projectedSpend === null));

    const current = summaryFor({ today: TODAY_MID_NOV });
    assert.equal(current.period.isCurrentMonth, true);
    assert.equal(current.period.daysElapsed, 12);
    assert.equal(current.totals.projectedMonthEnd, 691.25); // 276.5 / 12 × 30
    assert.equal(current.budgets!.rows.find((r) => r.category === "Grocery")!.projectedSpend, 501.88);
  });

  it("budgets are null when unavailable, never zero", () => {
    assert.equal(summaryFor({ budgets: null }).budgets, null);
  });

  it("pre-calculates savings opportunities", () => {
    const s = summaryFor();
    assert.deepEqual(s.savingsOpportunities.map((o) => o.amount), [10, 20.08, 116.5]);
    assert.match(s.savingsOpportunities[0].action, /Takeout back within/);
    assert.equal(s.savingsOpportunities[1].reductionPct, 10);
  });

  it("an empty month returns zeros and no projections", () => {
    const s = summaryFor({ budgets: [], expenses: [] });
    assert.equal(s.totals.spending, 0);
    assert.equal(s.totals.transactions, 0);
    assert.equal(s.totals.averageTransaction, 0);
    assert.equal(s.totals.changeVsPreviousMonthPct, null);
    assert.equal(s.totals.priorMonthsAverage, null);
    assert.deepEqual(s.categories, []);
    assert.deepEqual(s.savingsOpportunities, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Data privacy
// ─────────────────────────────────────────────────────────────────────────────

describe("data privacy", () => {
  const s = summaryFor({ today: TODAY_MID_NOV });
  const messages = buildInsightsMessages(s);
  const payload = JSON.stringify(messages);

  it("never includes descriptions, emails, tags, members, expense IDs or user IDs", () => {
    for (const forbidden of ["SECRET-MERCHANT", "jane.doe", "@example.com", "tag-costco", "member-anoosha", "00000000-0000-4000", "11111111-2222", "user_id", "description"]) {
      assert.ok(!payload.includes(forbidden), `payload leaked: ${forbidden}`);
    }
  });

  it("contains no email address or UUID at all", () => {
    assert.doesNotMatch(payload, /[\w.+-]+@[\w-]+\.[\w.]+/);
    assert.doesNotMatch(payload, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });

  it("does not list individual transactions or their dates", () => {
    for (const date of ["2026-11-03", "2026-11-08", "120.5"]) {
      assert.ok(!payload.includes(date), `payload contains transaction detail: ${date}`);
    }
  });

  it("summary has only the expected aggregate fields", () => {
    assert.deepEqual(Object.keys(s).sort(), [
      "budgets", "categories", "currency", "monthlyTrend", "period", "savingsOpportunities", "thresholds", "totals",
    ]);
    assert.deepEqual(Object.keys(s.categories[0]).sort(), [
      "category", "changePct", "previousMonthTotal", "sharePct", "total", "transactions",
    ]);
  });

  it("sends exactly a system and a user message", () => {
    assert.deepEqual(messages.map((m) => m.role), ["system", "user"]);
    assert.match(messages[0].content, /Use ONLY figures that appear in the JSON/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Grounding
// ─────────────────────────────────────────────────────────────────────────────

describe("grounding", () => {
  const s = summaryFor();
  const allowed = allowedNumbers(s);

  it("extracts money and percentages, including commas and compact forms", () => {
    const f = extractFigures("Spent £1,234.50 (12.5%) and £2k, down -3%");
    assert.deepEqual(f.map((x) => [x.kind, x.value]), [["money", 1234.5], ["money", 2000], ["percent", 12.5], ["percent", -3]]);
  });

  it("accepts exact figures and whole-number rounding", () => {
    assert.ok(isGrounded("You spent £276.50 this month", allowed));
    assert.ok(isGrounded("You spent £277 this month", allowed));
    assert.ok(isGrounded("Grocery is 72.6% of spending; up 33.8%", allowed));
    assert.ok(isGrounded("Takeout is £10 over budget", allowed));
    assert.ok(isGrounded("Alerts fire at 80% and 100%", allowed));
  });

  it("rejects invented amounts and percentages", () => {
    assert.ok(!isGrounded("You could save £500 a month", allowed));
    assert.ok(!isGrounded("Cut takeout by 37%", allowed));
    assert.deepEqual(ungroundedFigures("£276.50 and £123.45", allowed).map((f) => f.raw), ["£123.45"]);
  });

  it("text without figures is grounded", () => {
    assert.ok(isGrounded("Consider planning meals for the week.", allowed));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Response parsing
// ─────────────────────────────────────────────────────────────────────────────

const aiJson = (insights: unknown[], headline = "November spending was £276.50.") =>
  JSON.stringify({ headline, insights });

const GOOD = [
  { detail: "Takeout is £10 over its £50 budget.", kind: "risk", title: "Takeout over budget" },
  { detail: "Grocery has used 80.3% of its budget with £49.25 left.", kind: "risk", title: "Grocery near its limit" },
  { detail: "Reducing Grocery by 10% would save about £20.08.", kind: "saving", title: "Trim grocery spend" },
  { detail: "Spending rose 45.5% from £190 to £276.50.", kind: "trend", title: "Spending is up" },
];

describe("parseInsightsContent", () => {
  const s = summaryFor();

  it("accepts a valid, grounded response", () => {
    const r = parseInsightsContent(aiJson(GOOD), s);
    assert.ok(r.ok);
    assert.equal(r.insights.length, 4);
    assert.equal(r.dropped, 0);
    assert.equal(r.headline, "November spending was £276.50.");
  });

  it("tolerates ```json fences and surrounding text", () => {
    const r = parseInsightsContent("Here you go:\n```json\n" + aiJson(GOOD) + "\n```", s);
    assert.ok(r.ok);
  });

  it("rejects non-JSON and wrongly shaped JSON as bad_response", () => {
    assert.deepEqual(
      [parseInsightsContent("I cannot help", s), parseInsightsContent('{"foo": 1}', s)].map((r) => !r.ok && r.reason),
      ["bad_response", "bad_response"],
    );
  });

  it("drops insights that invent figures and keeps the rest", () => {
    const r = parseInsightsContent(
      aiJson([...GOOD.slice(0, 3), { detail: "You could save £900 by switching banks.", kind: "saving", title: "Switch" }]),
      s,
    );
    assert.ok(r.ok);
    assert.equal(r.insights.length, 3);
    assert.equal(r.dropped, 1);
  });

  it("fails as ungrounded when fewer than 3 insights survive", () => {
    const bad = { detail: "Save £1,000 this year.", kind: "saving", title: "Big savings" };
    const r = parseInsightsContent(aiJson([GOOD[0], bad, bad, bad]), s);
    assert.ok(!r.ok);
    assert.equal(r.reason, "ungrounded");
  });

  it("replaces an ungrounded headline with null (caller uses the exact one)", () => {
    const r = parseInsightsContent(aiJson(GOOD, "You spent £9,999!"), s);
    assert.ok(r.ok);
    assert.equal(r.headline, null);
  });

  it("caps at 5 insights, trims long text and defaults unknown kinds", () => {
    const long = { detail: "x ".repeat(400), kind: "mystery", title: "y".repeat(200) };
    const r = parseInsightsContent(aiJson([...GOOD, long, GOOD[0]]), s);
    assert.ok(r.ok);
    assert.equal(r.insights.length, 5);
    const trimmed = r.insights[4];
    assert.equal(trimmed.kind, "trend");
    assert.ok(trimmed.title.length <= 80 && trimmed.detail.length <= 320);
  });

  it("extractJsonObject throws when there is no object", () => {
    assert.throws(() => extractJsonObject("no json here"), SyntaxError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Deterministic fallback
// ─────────────────────────────────────────────────────────────────────────────

describe("deterministic fallback", () => {
  it("produces 3–5 insights, all grounded in the summary", () => {
    for (const s of [summaryFor(), summaryFor({ today: TODAY_MID_NOV }), summaryFor({ budgets: null }), summaryFor({ budgets: [] })]) {
      const insights = buildFallbackInsights(s);
      const allowed = allowedNumbers(s);
      assert.ok(insights.length >= 3 && insights.length <= 5, `got ${insights.length}`);
      for (const i of insights) assert.ok(isGrounded(`${i.title} ${i.detail}`, allowed), `${i.title}: ${i.detail}`);
      assert.ok(isGrounded(buildFallbackHeadline(s), allowed));
    }
  });

  it("lists over-budget risks first", () => {
    const [first] = buildFallbackInsights(summaryFor());
    assert.equal(first.kind, "risk");
    assert.equal(first.title, "Takeout is over budget");
    assert.match(first.detail, /£10\.00 over the limit/);
  });

  it("flags projected overspend in the current month", () => {
    const insights = buildFallbackInsights(summaryFor({ today: TODAY_MID_NOV }));
    assert.ok(insights.some((i) => i.title === "Grocery is on track to exceed its budget"));
  });

  it("suggests setting budgets when there are none", () => {
    const insights = buildFallbackInsights(summaryFor({ budgets: null }));
    assert.ok(insights.some((i) => i.title === "Set budgets for your main categories"));
  });

  it("is deterministic", () => {
    assert.deepEqual(buildFallbackInsights(summaryFor()), buildFallbackInsights(summaryFor()));
  });

  it("returns no insights and an honest headline for an empty month", () => {
    const s = summaryFor({ expenses: [] });
    assert.deepEqual(buildFallbackInsights(s), []);
    assert.equal(buildFallbackHeadline(s), "No spending recorded for November 2026 yet.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Pollinations client
// ─────────────────────────────────────────────────────────────────────────────

type Captured = { url?: string; init?: RequestInit };
const mockFetch = (respond: (c: Captured) => Response | Promise<Response>, captured: Captured = {}) =>
  (async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return respond(captured);
  }) as typeof fetch;

const MESSAGES: ChatMessage[] = [{ content: "hi", role: "user" }];
const okBody = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], model: "openai/gpt-5.4-nano" }), { status: 200 });

describe("callPollinations", () => {
  it("posts an OpenAI-compatible request with a Bearer secret key", async () => {
    const captured: Captured = {};
    const r = await callPollinations({ apiKey: "sk_test", fetchImpl: mockFetch(() => okBody("{}"), captured), messages: MESSAGES });
    assert.ok(r.ok);
    assert.equal(captured.url, POLLINATIONS_URL);
    assert.equal(captured.init?.method, "POST");
    assert.equal((captured.init?.headers as Record<string, string>).Authorization, "Bearer sk_test");
    const body = JSON.parse(String(captured.init?.body));
    assert.equal(body.model, DEFAULT_MODEL);
    assert.deepEqual(body.messages, MESSAGES);
    assert.deepEqual(body.response_format, { type: "json_object" });
  });

  it("does not call the network without a usable key", async () => {
    let called = false;
    const f = mockFetch(() => {
      called = true;
      return okBody("{}");
    });
    for (const apiKey of [undefined, "", "   ", "pk_publishable"]) {
      const r = await callPollinations({ apiKey, fetchImpl: f, messages: MESSAGES });
      assert.ok(!r.ok && r.reason === "not_configured");
    }
    assert.equal(called, false);
    assert.match(checkApiKey("pk_x")!, /secret \(sk_\) key/);
    assert.equal(checkApiKey("sk_x"), null);
  });

  const statusCases: Array<[status: number, body: string, reason: string]> = [
    [401, "{}", "unauthorized"],
    [403, "{}", "unauthorized"],
    [402, '{"error":{"code":"INSUFFICIENT_BALANCE"}}', "insufficient_balance"],
    [400, '{"error":{"code":"content_blocked"}}', "blocked"],
    [422, "{}", "blocked"],
    [400, '{"error":{"code":"BAD_REQUEST"}}', "bad_response"],
    [500, "{}", "unavailable"],
    [503, "{}", "unavailable"],
  ];
  for (const [status, body, reason] of statusCases) {
    it(`maps HTTP ${status} to ${reason}`, async () => {
      const r = await callPollinations({ apiKey: "sk_x", fetchImpl: mockFetch(() => new Response(body, { status })), messages: MESSAGES });
      assert.ok(!r.ok);
      assert.equal(r.reason, reason);
      assert.equal(r.status, status);
    });
  }

  it("maps 429 to rate_limited and reads Retry-After", async () => {
    const r = await callPollinations({
      apiKey: "sk_x",
      fetchImpl: mockFetch(() => new Response("{}", { headers: { "Retry-After": "42" }, status: 429 })),
      messages: MESSAGES,
    });
    assert.ok(!r.ok && r.reason === "rate_limited");
    assert.equal(r.retryAfterSeconds, 42);
  });

  it("times out and aborts a slow request", async () => {
    const slow = ((_: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      })) as typeof fetch;
    const started = Date.now();
    const r = await callPollinations({ apiKey: "sk_x", fetchImpl: slow, messages: MESSAGES, timeoutMs: 50 });
    assert.ok(!r.ok && r.reason === "timeout");
    assert.ok(Date.now() - started < 1000);
  });

  it("maps network errors to unavailable", async () => {
    const r = await callPollinations({
      apiKey: "sk_x",
      fetchImpl: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
      messages: MESSAGES,
    });
    assert.ok(!r.ok && r.reason === "unavailable");
  });

  it("treats empty content and unreadable bodies as bad_response", async () => {
    const empty = await callPollinations({ apiKey: "sk_x", fetchImpl: mockFetch(() => okBody("   ")), messages: MESSAGES });
    const junk = await callPollinations({ apiKey: "sk_x", fetchImpl: mockFetch(() => new Response("<html>", { status: 200 })), messages: MESSAGES });
    assert.ok(!empty.ok && empty.reason === "bad_response");
    assert.ok(!junk.ok && junk.reason === "bad_response");
  });

  it("never puts the key in results or messages", async () => {
    const r = await callPollinations({ apiKey: "sk_SUPERSECRET", fetchImpl: mockFetch(() => new Response("{}", { status: 401 })), messages: MESSAGES });
    assert.ok(!JSON.stringify(r).includes("SUPERSECRET"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Rate limiter
// ─────────────────────────────────────────────────────────────────────────────

describe("createRateLimiter", () => {
  const make = () => {
    let t = 0;
    const limiter = createRateLimiter({ limit: 3, minIntervalMs: 10_000, now: () => t, windowMs: 60_000 });
    return { advance: (ms: number) => (t += ms), limiter };
  };

  it("enforces a minimum interval between requests", () => {
    const { advance, limiter } = make();
    assert.ok(limiter.check("u1").allowed);
    advance(4_000);
    const d = limiter.check("u1");
    assert.ok(!d.allowed && d.reason === "too_soon" && d.retryAfterSeconds === 6);
  });

  it("caps requests per rolling window and reports when to retry", () => {
    const { advance, limiter } = make();
    for (let i = 0; i < 3; i++) {
      assert.ok(limiter.check("u1").allowed);
      advance(10_000);
    }
    const d = limiter.check("u1");
    assert.ok(!d.allowed && d.reason === "window_exhausted");
    assert.equal(d.retryAfterSeconds, 30); // first hit at t=0, now t=30s
    advance(30_000);
    assert.ok(limiter.check("u1").allowed);
  });

  it("limits each user independently", () => {
    const { limiter } = make();
    assert.ok(limiter.check("u1").allowed);
    assert.ok(limiter.check("u2").allowed);
    assert.ok(!limiter.check("u1").allowed);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Orchestration
// ─────────────────────────────────────────────────────────────────────────────

describe("generateInsights", () => {
  const base = {
    budgets: [budget(11, "1", 250), budget(11, "2", 50)],
    expenses: EXPENSES,
    month: 11,
    nameOf,
    today: AFTER_NOV,
    year: 2026,
  };

  it("returns AI insights when the AI answers with grounded JSON", async () => {
    let sent: ChatMessage[] = [];
    const r = await generateInsights({
      ...base,
      callAI: async (m) => {
        sent = m;
        return { content: aiJson(GOOD), model: "openai/gpt-5.4-nano", ok: true };
      },
    });
    assert.equal(r.source, "ai");
    assert.equal(r.insights.length, 4);
    assert.equal(r.model, "openai/gpt-5.4-nano");
    assert.ok(!JSON.stringify(sent).includes("SECRET-MERCHANT"));
  });

  it("falls back with the reason when the AI fails", async () => {
    for (const reason of ["timeout", "rate_limited", "unavailable", "not_configured", "insufficient_balance"] as const) {
      const r = await generateInsights({ ...base, callAI: async () => ({ message: "x", ok: false, reason }) });
      assert.equal(r.source, "fallback");
      assert.equal(r.fallbackReason, reason);
      assert.ok(r.insights.length >= 3);
    }
  });

  it("falls back when the AI invents figures", async () => {
    const bad = { detail: "Save £5,000.", kind: "saving", title: "Invented" };
    const r = await generateInsights({ ...base, callAI: async () => ({ content: aiJson([bad, bad, bad]), model: "m", ok: true }) });
    assert.equal(r.source, "fallback");
    assert.equal(r.fallbackReason, "ungrounded");
  });

  it("does not call the AI for a month with no spending", async () => {
    let called = false;
    const r = await generateInsights({
      ...base,
      callAI: async () => {
        called = true;
        return { content: "", model: "m", ok: true };
      },
      expenses: [],
    });
    assert.equal(called, false);
    assert.equal(r.fallbackReason, "no_data");
    assert.deepEqual(r.insights, []);
  });

  it("figures in the response summary match the records exactly", async () => {
    const r = await generateInsights({ ...base, callAI: async () => ({ message: "x", ok: false, reason: "timeout" }) });
    const s: InsightsSummary = r.summary;
    assert.equal(s.totals.spending, 276.5);
    assert.equal(s.budgets?.totalSpent, 260.75);
  });
});
