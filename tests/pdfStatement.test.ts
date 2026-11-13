/**
 * tests/pdfStatement.test.ts
 *
 * Unit tests for src/lib/pdfStatement.ts (PDF statement → expense rows).
 * Run with: npx tsx --test tests/pdfStatement.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStatementMessages,
  MAX_AI_TEXT,
  parseAITransactions,
  parseStatementText,
} from "../src/lib/pdfStatement";

// A made-up statement in a common UK layout: date, description, paid out,
// paid in, running balance.
const SAMPLE = `Statement period 1 Oct 2025 to 31 Oct 2025
Date Description Paid out Paid in Balance
01/10/2025 Opening balance 1,250.00
03/10/2025 TESCO STORES 3021 LONDON 23.45 1,226.55
05/10/2025 DELIVEROO 18.20 1,208.35
07/10/2025 SALARY ACME LTD 2,000.00 CR 3,208.35
10 Oct SHELL PETROL STATION 45.00 3,163.35
12 Oct 2025 AMAZON.CO.UK 12.99 3,150.36
15/10/25 TFL TRAVEL CH 6.80 3,143.56
20/10/2025 Payment received thank you 100.00 CR
31/10/2025 Closing balance 3,143.56`;

describe("parseStatementText", () => {
  const rows = parseStatementText(SAMPLE, new Date(2026, 0, 1));

  it("keeps spending lines and skips balances and money in", () => {
    assert.deepEqual(
      rows.map((r) => r.description),
      ["TESCO STORES 3021 LONDON", "DELIVEROO", "SHELL PETROL STATION", "AMAZON.CO.UK", "TFL TRAVEL CH"],
    );
  });

  it("takes the first amount on the line, not the running balance", () => {
    assert.deepEqual(rows.map((r) => r.amount), [23.45, 18.2, 45, 12.99, 6.8]);
  });

  it("reads UK day/month dates, short years and dates without a year", () => {
    assert.deepEqual(
      rows.map((r) => r.date),
      ["2025-10-03", "2025-10-05", "2025-10-10", "2025-10-12", "2025-10-15"],
    );
  });

  it("guesses categories and tags from the merchant name", () => {
    assert.deepEqual(rows.map((r) => r.categoryId), ["1", "2", "7", "4", "5"]);
    assert.equal(rows[3].tagId, "amazon");
    assert.equal(rows[0].tagId, null);
  });

  it("returns nothing for text without transactions", () => {
    assert.deepEqual(parseStatementText("Thank you for banking with us.\nPage 1 of 2"), []);
  });

  it("rejects impossible dates", () => {
    assert.deepEqual(parseStatementText("31/02/2025 SOMETHING 10.00"), []);
  });
});

describe("parseAITransactions", () => {
  it("accepts the {transactions: [...]} object shape", () => {
    const rows = parseAITransactions(
      JSON.stringify({
        transactions: [
          { amount: 9.99, categoryId: "8", date: "2025-10-02", description: "Netflix", tagId: null },
        ],
      }),
    );
    assert.deepEqual(rows, [
      { amount: 9.99, categoryId: "8", date: "2025-10-02", description: "Netflix", tagId: null },
    ]);
  });

  it("accepts a bare array and strips code fences", () => {
    const rows = parseAITransactions('```json\n[{"amount":"4.5","categoryId":"2","date":"2025-10-03","description":"Costa","tagId":"aldi"}]\n```');
    assert.equal(rows?.length, 1);
    assert.equal(rows?.[0].amount, 4.5);
    assert.equal(rows?.[0].tagId, "aldi");
  });

  it("drops rows with bad dates or amounts and fixes unknown ids", () => {
    const rows = parseAITransactions(
      JSON.stringify([
        { amount: 10, categoryId: "999", date: "2025-10-04", description: "Shop", tagId: "nope" },
        { amount: "abc", date: "2025-10-04" },
        { amount: 5, date: "04/10/2025" },
        { amount: 0, date: "2025-10-04" },
      ]),
    );
    assert.deepEqual(rows, [
      { amount: 10, categoryId: "3", date: "2025-10-04", description: "Shop", tagId: null },
    ]);
  });

  it("returns null for unusable answers", () => {
    assert.equal(parseAITransactions("not json"), null);
    assert.equal(parseAITransactions(JSON.stringify({ rows: [] })), null);
  });
});

describe("buildStatementMessages", () => {
  it("includes the rules, the category list and the (capped) statement text", () => {
    const long = "x".repeat(MAX_AI_TEXT + 500);
    const [system, user] = buildStatementMessages(long);
    assert.equal(system.role, "system");
    assert.match(system.content, /Grocery \(id: 1\)/);
    assert.match(system.content, /"transactions"/);
    assert.ok(user.content.length < MAX_AI_TEXT + 100);
  });
});
