/**
 * tests/onboarding.test.ts
 *
 *  1. First-run answers: validation (src/lib/onboarding/schemas.ts)
 *  2. Live summary and goal maths shown while answering
 *  3. Setup state stored in user metadata
 *  4. Daily tips: which one, and never about things already done (src/lib/onboarding/tips.ts)
 *  5. Daily reminder timing
 *
 * Run: node_modules/.bin/tsx --test tests/onboarding.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  monthlyForGoal,
  needsOnboarding,
  onboardingSchema,
  readInterests,
  setupSummary,
} from "../src/lib/onboarding/schemas.js";
import { isReminderDue, pickTip, TIPS } from "../src/lib/onboarding/tips.js";

const answers = {
  fixedCosts: [{ amount: 340, name: "Rent" }],
  fullName: "Sam Taylor",
  goal: { name: "Holiday", targetAmount: 800, targetDate: "2027-06-01" },
  interests: ["save", "track"],
  loadSampleData: false,
  monthlyIncome: 1100,
  monthlySavingsGoal: 200,
};

describe("onboarding answers", () => {
  it("accepts a full set of answers", () => {
    assert.equal(onboardingSchema.safeParse(answers).success, true);
  });

  it("only needs a name — everything else can be left blank", () => {
    const minimal = { ...answers, fixedCosts: [], goal: null, interests: [], monthlyIncome: null, monthlySavingsGoal: null };
    assert.equal(onboardingSchema.safeParse(minimal).success, true);
  });

  it("rejects unknown fields, bad amounts and unknown interests", () => {
    assert.equal(onboardingSchema.safeParse({ ...answers, isAdmin: true }).success, false);
    assert.equal(onboardingSchema.safeParse({ ...answers, monthlyIncome: -5 }).success, false);
    assert.equal(onboardingSchema.safeParse({ ...answers, monthlyIncome: 10.555 }).success, false);
    assert.equal(onboardingSchema.safeParse({ ...answers, interests: ["crypto"] }).success, false);
    assert.equal(onboardingSchema.safeParse({ ...answers, fullName: "" }).success, false);
  });

  it("caps the number of fixed costs and checks goal dates", () => {
    const many = Array.from({ length: 13 }, (_, i) => ({ amount: 10, name: `Bill ${i}` }));
    assert.equal(onboardingSchema.safeParse({ ...answers, fixedCosts: many }).success, false);
    const badDate = { ...answers, goal: { ...answers.goal, targetDate: "2027-02-30" } };
    assert.equal(onboardingSchema.safeParse(badDate).success, false);
  });
});

describe("setup summary", () => {
  it("works out what is left after rent and saving (£1,100 − £340 − £200)", () => {
    const s = setupSummary({ fixedCosts: [{ amount: 340 }], income: 1100, saving: 200, today: "2026-11-18" });
    assert.equal(s.fixed, 340);
    assert.equal(s.left, 560);
    // November has 30 days: £560 / 30 = £18.66 (rounded down to the penny).
    assert.equal(s.perDay, 18.66);
  });

  it("adds fixed costs in pence (no floating-point drift)", () => {
    const s = setupSummary({ fixedCosts: [{ amount: 0.1 }, { amount: 0.2 }], income: 1, saving: null, today: "2026-11-18" });
    assert.equal(s.fixed, 0.3);
    assert.equal(s.left, 0.7);
  });

  it("has no left-over without an income, and never a negative daily amount", () => {
    assert.deepEqual(setupSummary({ fixedCosts: [], income: null, saving: 50, today: "2026-11-18" }), { fixed: 0, left: null, perDay: null });
    const over = setupSummary({ fixedCosts: [{ amount: 900 }], income: 800, saving: 0, today: "2026-11-18" });
    assert.equal(over.left, -100);
    assert.equal(over.perDay, 0);
  });

  it("splits a goal over the months until its date (at least one), rounding up", () => {
    assert.equal(monthlyForGoal(800, "2027-06-01", "2026-11-18"), 115); // 7 months → £114.29 → £115
    assert.equal(monthlyForGoal(600, "2026-11-30", "2026-11-18"), 600);
    assert.equal(monthlyForGoal(600, null, "2026-11-18"), null);
  });
});

describe("setup state", () => {
  it("asks new users, not people who finished or skipped", () => {
    assert.equal(needsOnboarding(undefined), true);
    assert.equal(needsOnboarding({}), true);
    assert.equal(needsOnboarding({ completedAt: "2026-11-18T10:00:00Z" }), false);
    assert.equal(needsOnboarding({ skippedAt: "2026-11-18T10:00:00Z" }), false);
  });

  it("reads interests defensively from metadata", () => {
    assert.deepEqual(readInterests({ interests: ["save", "bogus", "owe"] }), ["save", "owe"]);
    assert.deepEqual(readInterests({ interests: "save" }), []);
    assert.deepEqual(readInterests(null), []);
  });
});

describe("daily tips", () => {
  it("prefers tips about what the user said they care about", () => {
    for (const day of ["2026-11-18", "2026-11-19", "2026-11-20"]) {
      const tip = pickTip({ dateKey: day, done: {}, interests: ["owe"] });
      assert.equal(tip?.id, "iou");
    }
  });

  it("never suggests something already done", () => {
    const tip = pickTip({ dateKey: "2026-11-18", done: { iou: true }, interests: ["owe"] });
    assert.notEqual(tip?.id, "iou");
    assert.ok(tip);
  });

  it("rotates through every remaining tip, one per day", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= TIPS.length; d++) {
      const tip = pickTip({ dateKey: `2026-12-${String(d).padStart(2, "0")}`, done: {}, interests: [] });
      if (tip) seen.add(tip.id);
    }
    assert.equal(seen.size, TIPS.length);
  });

  it("stops once everything has been tried", () => {
    const done = Object.fromEntries(TIPS.map((t) => [t.id, true]));
    assert.equal(pickTip({ dateKey: "2026-11-18", done, interests: [] }), null);
  });
});

describe("daily reminder", () => {
  const at = (h: number, m: number) => new Date(2026, 10, 18, h, m);

  it("is due from the chosen time, once a day", () => {
    assert.equal(isReminderDue({ lastShown: null, now: at(19, 59), time: "20:00" }), false);
    assert.equal(isReminderDue({ lastShown: null, now: at(20, 0), time: "20:00" }), true);
    assert.equal(isReminderDue({ lastShown: "2026-11-17", now: at(22, 30), time: "20:00" }), true);
    assert.equal(isReminderDue({ lastShown: "2026-11-18", now: at(22, 30), time: "20:00" }), false);
  });

  it("ignores a malformed time", () => {
    assert.equal(isReminderDue({ lastShown: null, now: at(23, 0), time: "late" }), false);
  });
});
