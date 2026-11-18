/**
 * tests/aiAndPlan.test.ts
 *
 *  1. Savings plan maths (src/lib/plan/calc.ts)
 *  2. Receipt scanning: image checks and parsing the AI's answer (src/lib/receipts/receipt.ts)
 *  3. Assistant: understanding questions (src/lib/assistant/query.ts, ai.ts)
 *  4. Assistant: answers built from data (src/lib/assistant/answer.ts)
 *  5. Sample data for the new features
 *
 * Run: node_modules/.bin/tsx --test tests/aiAndPlan.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAiQuery } from "../src/lib/assistant/ai.js";
import { answerOwed, answerSpending, matchesSpending, matchPerson, type SpendRow } from "../src/lib/assistant/answer.js";
import {
  applyContext,
  type AssistantQuery,
  detectPeriod,
  extractSearch,
  parseQuestion,
  resolvePeriod,
} from "../src/lib/assistant/query.js";
import type { Iou } from "../src/lib/money/schemas.js";
import {
  buildPlan,
  goalPlan,
  matchesFixedCost,
  monthlyHistory,
  monthsUntil,
  projectSavings,
  recentMonths,
} from "../src/lib/plan/calc.js";
import { goalCreateSchema } from "../src/lib/plan/schemas.js";
import { guessCategoryId, parseImageDataUrl, parseReceiptContent } from "../src/lib/receipts/receipt.js";
import { generateSampleData } from "../src/lib/sampleData.js";

const TODAY = "2026-11-18";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Savings plan
// ─────────────────────────────────────────────────────────────────────────────

describe("savings plan maths", () => {
  const rent = { amount: 340, dueDay: 1, id: "f1", name: "Rent" };
  const phone = { amount: 20, dueDay: 12, id: "f2", name: "Mobile plan" };

  it("counts months to a deadline (minimum 1)", () => {
    assert.equal(monthsUntil(TODAY, "2027-11-18"), 12);
    assert.equal(monthsUntil(TODAY, "2026-12-01"), 1);
    assert.equal(monthsUntil(TODAY, "2026-11-30"), 1);
  });

  it("works out the monthly amount each goal needs, rounding up to the penny", () => {
    const g = goalPlan({ id: "g", name: "Fund", savedAmount: 850, targetAmount: 3000, targetDate: "2027-11-18" }, TODAY);
    assert.equal(g.monthsLeft, 12);
    assert.equal(g.monthlyNeed, 179.17);
    assert.equal(goalPlan({ id: "g", name: "Laptop", savedAmount: 0, targetAmount: 900, targetDate: null }, TODAY).monthlyNeed, null);
    assert.equal(goalPlan({ id: "g", name: "Done", savedAmount: 500, targetAmount: 500, targetDate: "2027-01-01" }, TODAY).monthlyNeed, 0);
  });

  it("never counts a fixed cost twice when it is also recorded as an expense", () => {
    assert.ok(matchesFixedCost("Rent – November", [rent]));
    assert.ok(matchesFixedCost("Mobile plan – giffgaff", [phone]));
    assert.equal(matchesFixedCost("Parent's gift", [rent]), false, "whole words only");
    const history = monthlyHistory({
      expenses: [
        { amount: 340, date: "2026-10-01", description: "Rent – October" },
        { amount: 200, date: "2026-10-05", description: "Groceries" },
        { amount: 100, date: "2026-11-03", description: "Groceries" },
      ],
      fixedCosts: [rent, phone],
      income: 1100,
      months: ["2026-10", "2026-11"],
      today: TODAY,
    });
    // October: rent was recorded but is a fixed cost → everyday = £200; saved = 1100 − 360 − 200.
    assert.deepEqual(
      history.map((h) => [h.month, h.spent, h.everyday, h.saved, h.complete]),
      [
        ["2026-10", 540, 200, 540, true],
        ["2026-11", 100, 100, 640, false],
      ],
    );
  });

  it("builds the plan: salary → fixed costs → goals → left to spend, with a status", () => {
    const history = monthlyHistory({
      expenses: [
        { amount: 500, date: "2026-08-10", description: "Shopping" },
        { amount: 500, date: "2026-09-10", description: "Shopping" },
        { amount: 500, date: "2026-10-10", description: "Shopping" },
      ],
      fixedCosts: [rent],
      income: 1100,
      months: recentMonths(TODAY, 4),
      today: TODAY,
    });
    const goals = [{ id: "g1", name: "Fund", savedAmount: 0, targetAmount: 1200, targetDate: "2027-11-18" }];
    const plan = buildPlan({ fixedCosts: [rent], goals, history, income: 1100, today: TODAY });
    assert.equal(plan.afterFixed, 760);
    assert.equal(plan.goalsMonthly, 100);
    assert.equal(plan.leftToSpend, 660);
    assert.equal(plan.leftToSpendPerDay, 22);
    assert.equal(plan.avgEveryday, 500);
    assert.equal(plan.avgSaved, 260);
    assert.equal(plan.status, "on-track");
    assert.equal(plan.suggestedMonthly, 260);

    const big = buildPlan({ fixedCosts: [rent], goals: [{ ...goals[0], targetAmount: 12000 }], history, income: 1100, today: TODAY });
    assert.equal(big.status, "goals-unaffordable");
    const behind = buildPlan({ fixedCosts: [rent], goals: [{ ...goals[0], targetAmount: 4800 }], history, income: 1100, today: TODAY });
    assert.equal(behind.status, "behind");
    assert.equal(buildPlan({ fixedCosts: [], goals: [], history, income: null, today: TODAY }).status, "no-income");
  });

  it("projects savings and when each goal is reached, nearest deadline first", () => {
    const goals = [
      goalPlan({ id: "a", name: "Holiday", savedAmount: 100, targetAmount: 500, targetDate: "2027-03-01" }, TODAY),
      goalPlan({ id: "b", name: "Fund", savedAmount: 0, targetAmount: 1000, targetDate: "2027-06-01" }, TODAY),
    ];
    const { milestones, points } = projectSavings({ goals, monthly: 200, months: 12, start: 100, today: TODAY });
    const slower = projectSavings({ goals, monthly: 100, months: 24, start: 100, today: TODAY });
    assert.equal(slower.milestones[1].onTime, false, "at £100/month the fund misses its June deadline");
    assert.equal(points[0].total, 100);
    assert.equal(points[12].total, 2500);
    assert.deepEqual(
      milestones.map((m) => [m.name, m.reachedMonth, m.reachedLabel, m.onTime]),
      [
        ["Holiday", 2, "Jan 2027", true],
        ["Fund", 7, "Jun 2027", true],
      ],
    );
    assert.equal(projectSavings({ goals, monthly: 0, months: 3, start: 0, today: TODAY }).milestones[0].reachedMonth, null);
  });

  it("validates goals", () => {
    assert.ok(goalCreateSchema.safeParse({ name: "Fund", targetAmount: 3000, targetDate: "2027-11-18" }).success);
    assert.equal(goalCreateSchema.safeParse({ name: "", targetAmount: 3000 }).success, false);
    assert.equal(goalCreateSchema.safeParse({ name: "Fund", targetAmount: -1 }).success, false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Receipts
// ─────────────────────────────────────────────────────────────────────────────

describe("receipt scanning", () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]).toString("base64")}`;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200)]).toString("base64");

  it("accepts real images and rejects disguised or oversized files", () => {
    assert.deepEqual(parseImageDataUrl(jpeg), { bytes: 204, mime: "image/jpeg" });
    assert.ok("mime" in parseImageDataUrl(`data:image/png;base64,${png}`));
    assert.ok("error" in parseImageDataUrl(`data:image/jpeg;base64,${png}`), "PNG bytes declared as JPEG");
    assert.ok("error" in parseImageDataUrl(`data:text/html;base64,${png}`));
    assert.ok("error" in parseImageDataUrl("not a data url"));
    const huge = `data:image/jpeg;base64,/9j/${"A".repeat(6 * 1024 * 1024)}`;
    assert.ok("error" in parseImageDataUrl(huge));
  });

  it("turns the AI's JSON into a checked draft (Timberland example)", () => {
    const result = parseReceiptContent(
      'Here you go: {"isReceipt":true,"merchant":"Timberland","date":"2026-11-15","total":"£129.99","currency":"GBP","category":"Shopping","items":[{"name":"6-Inch Premium Boot","amount":129.99}],"confidence":"high"}',
      TODAY,
    );
    assert.ok(result.ok);
    assert.deepEqual(result.draft, {
      categoryId: "4",
      confidence: "high",
      currency: null,
      date: "2026-11-15",
      dateFromReceipt: true,
      description: "Timberland – 6-Inch Premium Boot",
      items: [{ amount: 129.99, name: "6-Inch Premium Boot" }],
      merchant: "Timberland",
      total: 129.99,
    });
  });

  it("falls back safely: future dates → today, unknown category → guessed, foreign currency flagged", () => {
    const result = parseReceiptContent(
      '{"isReceipt":true,"merchant":"Shell","date":"2027-01-01","total":61.2,"currency":"EUR","category":"Rockets","items":[],"confidence":"medium"}',
      TODAY,
    );
    assert.ok(result.ok);
    assert.equal(result.draft.date, TODAY);
    assert.equal(result.draft.dateFromReceipt, false);
    assert.equal(result.draft.categoryId, "7");
    assert.equal(result.draft.currency, "EUR");
  });

  it("marks unreadable totals low-confidence and rejects non-receipts and junk", () => {
    const noTotal = parseReceiptContent('{"isReceipt":true,"merchant":"Aldi","total":null,"confidence":"high"}', TODAY);
    assert.ok(noTotal.ok && noTotal.draft.total === null && noTotal.draft.confidence === "low");
    assert.equal(parseReceiptContent('{"isReceipt":false}', TODAY).ok, false);
    assert.equal(parseReceiptContent("I can't help with that.", TODAY).ok, false);
    const negative = parseReceiptContent('{"isReceipt":true,"total":-5,"merchant":"X"}', TODAY);
    assert.ok(negative.ok && negative.draft.total === null, "negative totals are discarded");
  });

  it("guesses categories from shop names", () => {
    assert.equal(guessCategoryId("TIMBERLAND OXFORD ST"), "4");
    assert.equal(guessCategoryId("Tesco Express"), "1");
    assert.equal(guessCategoryId("TfL Travel Charge"), "5");
    assert.equal(guessCategoryId("Something else"), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Understanding questions
// ─────────────────────────────────────────────────────────────────────────────

describe("assistant: understanding questions", () => {
  it("finds periods, including named months", () => {
    assert.equal(detectPeriod("how much last month", TODAY, "this_month"), "last_month");
    assert.equal(detectPeriod("spent in October?", TODAY, "this_month"), "month:2026-10");
    assert.equal(detectPeriod("spent in december", TODAY, "this_month"), "month:2025-12");
    assert.equal(detectPeriod("how much ever", TODAY, "this_month"), "all_time");
    assert.equal(detectPeriod("how much", TODAY, "this_month"), "this_month");
  });

  it("resolves periods to date ranges with a comparison period", () => {
    assert.deepEqual(resolvePeriod("this_month", TODAY), {
      from: "2026-11-01",
      label: "this month",
      previous: { from: "2026-10-01", label: "the same point last month", to: "2026-10-18" },
      to: TODAY,
    });
    const feb = resolvePeriod("month:2028-02", TODAY);
    assert.equal(feb.to, "2028-02-29");
    assert.equal(resolvePeriod("last_month", TODAY).from, "2026-10-01");
    assert.equal(resolvePeriod("last_month", TODAY).to, "2026-10-31");
  });

  it("pulls out the shop or keyword, keeping the user's spelling", () => {
    assert.equal(extractSearch("How much did I spend on TfL this month?"), "TfL");
    assert.equal(extractSearch("what did I spend at Timberland"), "Timberland");
    assert.equal(extractSearch("tfl spending last month"), "tfl");
    assert.equal(extractSearch("how much did I spend this month?"), null);
  });

  it("recognises each kind of question", () => {
    const q = (text: string, ctx = {}) => parseQuestion(text, TODAY, ctx);
    assert.deepEqual(
      [q("How much did I spend on TfL this month?").intent, q("How much did I spend on TfL this month?").search],
      ["spending", "TfL"],
    );
    const groceries = q("how much on groceries last month");
    assert.deepEqual([groceries.intent, groceries.categoryId, groceries.period], ["spending", "1", "last_month"]);
    assert.deepEqual([q("How much does Sara owe me?").intent, q("How much does Sara owe me?").person], ["owed", "Sara"]);
    assert.equal(q("how much do I owe him?").person, "PREVIOUS");
    assert.equal(q("who owes me money?").direction, "owed_to_me");
    assert.equal(q("who do I owe?").direction, "i_owe");
    assert.deepEqual([q("Can I afford the headphones?").intent, q("Can I afford the headphones?").item], ["wishlist", "headphones"]);
    assert.equal(q("How much should I save to reach my goals?").intent, "plan");
    assert.equal(q("I make 1100 and my rent is 340, how much can I save?").intent, "plan");
    assert.equal(q("How much have I saved this month?").intent, "savings");
    assert.equal(q("hello").intent, "help");
  });

  it("follows the conversation: “him”, “and last month?”, “on that”", () => {
    const ctx = { intent: "spending" as const, search: "TfL" };
    const followUp = parseQuestion("and last month?", TODAY, ctx);
    assert.deepEqual([followUp.intent, followUp.search, followUp.period], ["spending", "TfL", "last_month"]);
    assert.equal(parseQuestion("how much did I spend on that this year", TODAY, ctx).search, "TfL");
    assert.equal(parseQuestion("how much did I spend this month?", TODAY, ctx).search, null, "a fresh question doesn't inherit the subject");
    const him = applyContext(parseQuestion("how much does he owe me", TODAY), { intent: "owed", person: "Tom" });
    assert.equal(him.person, "Tom");
    assert.equal(parseQuestion("what about Priya?", TODAY, { intent: "owed", person: "Tom" }).person, "Priya");
  });

  it("validates the AI's reading and rejects anything unusable", () => {
    const parsed = parseAiQuery(
      '{"intent":"spending","period":"last_month","search":"TfL","category":null,"person":null,"direction":null,"item":null}',
    );
    assert.deepEqual(parsed, { categoryId: null, direction: null, intent: "spending", item: null, period: "last_month", person: null, search: "TfL" });
    assert.equal(parseAiQuery('{"intent":"spending","category":"Grocery","period":"whenever"}')?.categoryId, "1");
    assert.equal(parseAiQuery('{"intent":"spending","category":"Grocery","period":"whenever"}')?.period, "this_month");
    assert.equal(parseAiQuery('{"intent":"delete_everything"}'), null);
    assert.equal(parseAiQuery("not json"), null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Answers
// ─────────────────────────────────────────────────────────────────────────────

describe("assistant: answers from data", () => {
  const rows: SpendRow[] = [
    { amount: 20, categoryId: "5", date: "2026-11-02", description: "TfL – Oyster top-up", tagId: "others" },
    { amount: 2.8, categoryId: "5", date: "2026-11-10", description: "TfL – Tube journey", tagId: "others" },
    { amount: 10.99, categoryId: "3", date: "2026-11-05", description: "Netflix", tagId: null },
    { amount: 60, categoryId: "1", date: "2026-11-09", description: "Weekly groceries", tagId: "aldi" },
  ];
  const query = (fields: Partial<AssistantQuery>): AssistantQuery => ({
    categoryId: null,
    direction: null,
    intent: "spending",
    item: null,
    period: "this_month",
    person: null,
    search: null,
    ...fields,
  });

  it("matches whole words, so TfL never matches Netflix", () => {
    assert.equal(matchesSpending(rows[2], { categoryId: null, search: "tfl" }), false);
    assert.ok(matchesSpending(rows[0], { categoryId: null, search: "TfL" }));
    assert.ok(matchesSpending(rows[3], { categoryId: null, search: "Aldi" }), "tags count as places");
  });

  it("answers “how much did I spend on TfL this month?” with a comparison", () => {
    const reply = answerSpending({
      current: rows,
      period: resolvePeriod("this_month", TODAY),
      previous: [{ amount: 15, categoryId: "5", date: "2026-10-03", description: "TfL – Bus fare", tagId: null }],
      query: query({ search: "TfL" }),
    });
    assert.equal(
      reply.text,
      "You spent £22.80 on TfL this month — 2 transactions. That’s £7.80 more than the same point last month (£15.00).",
    );
    assert.deepEqual(reply.facts[0], { label: "Total", value: "£22.80" });
    assert.equal(reply.items[0].title, "TfL – Tube journey");
    assert.equal(reply.context.search, "TfL");
  });

  it("says so when nothing matches", () => {
    const reply = answerSpending({ current: rows, period: resolvePeriod("this_month", TODAY), previous: null, query: query({ search: "Timberland" }) });
    assert.match(reply.text, /couldn’t find any spending on Timberland this month/);
  });

  const iou = (fields: Partial<Iou>): Iou => ({
    amount: 100,
    createdAt: "",
    date: "2026-11-01",
    description: null,
    direction: "lent",
    dueDate: null,
    id: Math.random().toString(36),
    paidAmount: 0,
    person: "Sara",
    settledAt: null,
    ...fields,
  });
  const ious = [
    iou({ amount: 120, description: "Concert tickets", paidAmount: 40, person: "Sara" }),
    iou({ amount: 300, direction: "borrowed", dueDate: "2027-01-02", paidAmount: 100, person: "Mum" }),
    iou({ amount: 25, dueDate: "2026-11-01", person: "Tom" }),
  ];

  it("finds people by name, part of a name or case", () => {
    assert.equal(matchPerson("sara", ["Sara", "Mum"]), "Sara");
    assert.equal(matchPerson("mu", ["Sara", "Mum"]), "Mum");
    assert.equal(matchPerson("Bob", ["Sara"]), null);
  });

  it("answers who owes who, per person and overall", () => {
    assert.equal(answerOwed({ ious, query: query({ intent: "owed", person: "Sara" }), today: TODAY }).text, "Sara owes you £80.00.");
    assert.equal(
      answerOwed({ ious, query: query({ intent: "owed", person: "mum" }), today: TODAY }).text,
      "You owe Mum £200.00. Next one is due 2 Jan 2027.",
    );
    assert.match(answerOwed({ ious, query: query({ intent: "owed", person: "Tom" }), today: TODAY }).text, /overdue/);
    assert.equal(
      answerOwed({ ious, query: query({ direction: "owed_to_me", intent: "owed" }), today: TODAY }).text,
      "People owe you £105.00: Sara £80.00, Tom £25.00.",
    );
    assert.match(answerOwed({ ious, query: query({ intent: "owed", person: "Bob" }), today: TODAY }).text, /couldn’t find anyone called Bob/);
    assert.equal(answerOwed({ ious, query: query({ intent: "owed", person: "Sara" }), today: TODAY }).context.person, "Sara");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Sample data
// ─────────────────────────────────────────────────────────────────────────────

describe("sample data for the plan and assistant", () => {
  const data = generateSampleData(new Date(2026, 10, 18));

  it("has TfL spending every month so “how much on TfL?” has an answer", () => {
    const months = new Set(data.expenses.filter((e) => e.description.startsWith("TfL")).map((e) => e.date.slice(0, 7)));
    assert.equal(months.size, data.months);
  });

  it("names fixed costs like their expenses, so the plan doesn't double count", () => {
    const fixed = data.fixedCosts.map((f) => ({ ...f }));
    const matched = data.expenses.filter((e) => matchesFixedCost(e.description, fixed));
    assert.ok(matched.some((e) => e.description === "Council tax"));
    assert.ok(matched.some((e) => e.description.startsWith("Mobile plan")));
    assert.equal(data.fixedCosts.find((f) => f.name === "Rent")?.amount, 340);
  });

  it("includes goals with and without deadlines that pass the API schema", () => {
    assert.ok(data.goals.some((g) => g.targetDate) && data.goals.some((g) => !g.targetDate));
    for (const { id: _id, ...goal } of data.goals) assert.ok(goalCreateSchema.safeParse(goal).success, goal.name);
  });
});
