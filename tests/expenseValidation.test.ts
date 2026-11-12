/**
 * tests/expenseValidation.test.ts
 *
 * Unit tests for src/lib/expenseValidation.ts
 * Run with: node --import tsx/esm --test tests/expenseValidation.test.ts
 * Or:        npx tsx --test tests/expenseValidation.test.ts
 *
 * Uses Node 18+ built-in test runner (node:test) — no extra test framework
 * needed.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

// We import directly from the source (tsx resolves TypeScript).
// Path aliases (@/) are resolved via tsconfig paths — tsx handles this.
import {
  MAX_AMOUNT,
  MIN_AMOUNT_ABS,
  MAX_DESCRIPTION_LENGTH,
  assertValidCreateInput,
  assertValidUpdateInput,
  validateAmount,
  validateCreateExpenseInput,
  validateDate,
  validateDescription,
  validateUpdateExpenseInput,
} from "../src/lib/expenseValidation.js";

// ---------------------------------------------------------------------------
// validateAmount
// ---------------------------------------------------------------------------
describe("validateAmount", () => {
  it("accepts a normal positive amount", () => {
    assert.equal(validateAmount(42.5), undefined);
  });

  it("accepts a negative amount (refund)", () => {
    assert.equal(validateAmount(-10), undefined);
  });

  it("accepts the maximum allowed amount", () => {
    assert.equal(validateAmount(MAX_AMOUNT), undefined);
  });

  it("accepts the minimum absolute amount", () => {
    assert.equal(validateAmount(MIN_AMOUNT_ABS), undefined);
  });

  it("rejects zero", () => {
    assert.notEqual(validateAmount(0), undefined);
  });

  it("rejects -0", () => {
    assert.notEqual(validateAmount(-0), undefined);
  });

  it("rejects NaN", () => {
    assert.notEqual(validateAmount(NaN), undefined);
  });

  it("rejects Infinity", () => {
    assert.notEqual(validateAmount(Infinity), undefined);
  });

  it("rejects -Infinity", () => {
    assert.notEqual(validateAmount(-Infinity), undefined);
  });

  it("rejects a string", () => {
    assert.notEqual(validateAmount("42"), undefined);
  });

  it("rejects null", () => {
    assert.notEqual(validateAmount(null), undefined);
  });

  it("rejects undefined", () => {
    assert.notEqual(validateAmount(undefined), undefined);
  });

  it("rejects an amount exceeding MAX_AMOUNT", () => {
    assert.notEqual(validateAmount(MAX_AMOUNT + 1), undefined);
  });

  it("rejects more than 2 decimal places", () => {
    assert.notEqual(validateAmount(1.123), undefined);
  });

  it("accepts exactly 2 decimal places", () => {
    assert.equal(validateAmount(1.12), undefined);
  });
});

// ---------------------------------------------------------------------------
// validateDate
// ---------------------------------------------------------------------------
describe("validateDate", () => {
  it("accepts a valid Date object", () => {
    assert.equal(validateDate(new Date("2024-01-15")), undefined);
  });

  it("accepts a valid ISO string", () => {
    assert.equal(validateDate("2024-06-30"), undefined);
  });

  it("rejects an invalid Date object", () => {
    assert.notEqual(validateDate(new Date("not-a-date")), undefined);
  });

  it("rejects a non-ISO string", () => {
    assert.notEqual(validateDate("15/01/2024"), undefined);
  });

  it("rejects null", () => {
    assert.notEqual(validateDate(null), undefined);
  });

  it("rejects undefined", () => {
    assert.notEqual(validateDate(undefined), undefined);
  });

  it("rejects a number", () => {
    assert.notEqual(validateDate(1718000000000), undefined);
  });

  it("rejects a partial ISO string", () => {
    assert.notEqual(validateDate("2024-13"), undefined);
  });

  it("rejects month 13", () => {
    assert.notEqual(validateDate("2024-13-01"), undefined);
  });
});

// ---------------------------------------------------------------------------
// validateDescription
// ---------------------------------------------------------------------------
describe("validateDescription", () => {
  it("accepts undefined (optional field)", () => {
    assert.equal(validateDescription(undefined), undefined);
  });

  it("accepts null", () => {
    assert.equal(validateDescription(null), undefined);
  });

  it("accepts an empty string", () => {
    assert.equal(validateDescription(""), undefined);
  });

  it("accepts a normal description", () => {
    assert.equal(validateDescription("Coffee at Starbucks"), undefined);
  });

  it("accepts a description exactly at MAX_DESCRIPTION_LENGTH", () => {
    assert.equal(validateDescription("x".repeat(MAX_DESCRIPTION_LENGTH)), undefined);
  });

  it("rejects a description exceeding MAX_DESCRIPTION_LENGTH", () => {
    assert.notEqual(
      validateDescription("x".repeat(MAX_DESCRIPTION_LENGTH + 1)),
      undefined,
    );
  });

  it("rejects a non-string value", () => {
    assert.notEqual(validateDescription(42), undefined);
  });
});

// ---------------------------------------------------------------------------
// validateCreateExpenseInput
// ---------------------------------------------------------------------------
describe("validateCreateExpenseInput", () => {
  const validInput = {
    amount: 25.99,
    categoryId: "1",
    date: "2024-06-15",
    description: "Grocery run",
    tagId: "walmart",
  };

  it("returns valid for a well-formed input", () => {
    const result = validateCreateExpenseInput(validInput);
    assert.equal(result.valid, true);
  });

  it("returns invalid when amount is zero", () => {
    const result = validateCreateExpenseInput({ ...validInput, amount: 0 });
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.errors.length > 0);
  });

  it("returns invalid for a bad date string", () => {
    const result = validateCreateExpenseInput({ ...validInput, date: "not-a-date" });
    assert.equal(result.valid, false);
  });

  it("accumulates multiple errors", () => {
    const result = validateCreateExpenseInput({
      ...validInput,
      amount: 0,
      date: "bad-date",
    });
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.errors.length >= 2);
  });

  it("accepts null categoryId and tagId (nullable references)", () => {
    const result = validateCreateExpenseInput({
      ...validInput,
      categoryId: null,
      tagId: null,
    });
    assert.equal(result.valid, true);
  });
});

// ---------------------------------------------------------------------------
// validateUpdateExpenseInput
// ---------------------------------------------------------------------------
describe("validateUpdateExpenseInput", () => {
  it("returns valid for an id-only update (no fields changed)", () => {
    const result = validateUpdateExpenseInput({ id: "abc-123" });
    assert.equal(result.valid, true);
  });

  it("returns invalid when id is missing", () => {
    const result = validateUpdateExpenseInput({ id: "" });
    assert.equal(result.valid, false);
  });

  it("validates amount if provided", () => {
    const result = validateUpdateExpenseInput({ id: "abc-123", amount: 0 });
    assert.equal(result.valid, false);
  });

  it("skips amount validation if amount not provided", () => {
    const result = validateUpdateExpenseInput({ id: "abc-123" });
    assert.equal(result.valid, true);
  });

  it("validates date if provided", () => {
    const result = validateUpdateExpenseInput({ id: "abc-123", date: "bad" });
    assert.equal(result.valid, false);
  });
});

// ---------------------------------------------------------------------------
// assertValidCreateInput — throw behaviour
// ---------------------------------------------------------------------------
describe("assertValidCreateInput", () => {
  it("does not throw for valid input", () => {
    assert.doesNotThrow(() =>
      assertValidCreateInput({
        amount: 15,
        categoryId: "1",
        date: "2024-03-10",
        tagId: null,
      }),
    );
  });

  it("throws TypeError for zero amount", () => {
    assert.throws(
      () =>
        assertValidCreateInput({
          amount: 0,
          categoryId: "1",
          date: "2024-03-10",
          tagId: null,
        }),
      TypeError,
    );
  });
});

// ---------------------------------------------------------------------------
// assertValidUpdateInput — throw behaviour
// ---------------------------------------------------------------------------
describe("assertValidUpdateInput", () => {
  it("does not throw for a valid partial update", () => {
    assert.doesNotThrow(() => assertValidUpdateInput({ id: "some-uuid", amount: 9.99 }));
  });

  it("throws TypeError when id is empty", () => {
    assert.throws(() => assertValidUpdateInput({ id: "" }), TypeError);
  });
});
