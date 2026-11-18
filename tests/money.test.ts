/**
 * tests/money.test.ts
 *
 * Lend & borrow, Wishlist and "Savings this month":
 *  1. Request schemas (src/lib/money/schemas.ts)
 *  2. Schemas vs. the SQL migration
 *  3. IOU totals and per-person balances (src/lib/money/summary.ts)
 *  4. Wishlist totals and ordering
 *  5. Month savings: saved so far, projection, goal status, safe to spend
 *  6. Sample data for the new tables
 *
 * Run: node_modules/.bin/tsx --test tests/money.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  type Iou,
  IOU_DIRECTIONS,
  iouCreateSchema,
  iouUpdateSchema,
  PRIORITIES,
  wishlistCreateSchema,
  type WishlistItem,
  wishlistUpdateSchema,
} from "../src/lib/money/schemas.js";
import {
  isOverdue,
  monthSavings,
  outstanding,
  sortWishlist,
  summarizeIous,
  summarizeWishlist,
} from "../src/lib/money/summary.js";
import { generateSampleData, isSampleId } from "../src/lib/sampleData.js";

const MIGRATION = readFileSync(
  new URL("../supabase/migrations/20261118000000_create_ious_and_wishlist.sql", import.meta.url),
  "utf8",
);

const iou = (fields: Partial<Iou>): Iou => ({
  amount: 100,
  createdAt: "2026-11-01T00:00:00Z",
  date: "2026-11-01",
  description: null,
  direction: "lent",
  dueDate: null,
  id: crypto.randomUUID(),
  paidAmount: 0,
  person: "Sara",
  settledAt: null,
  ...fields,
});

const item = (fields: Partial<WishlistItem>): WishlistItem => ({
  categoryId: "4",
  createdAt: "2026-11-01T00:00:00Z",
  expenseId: null,
  id: crypto.randomUUID(),
  name: "Thing",
  notes: null,
  price: 100,
  priority: "medium",
  purchasedAt: null,
  savedAmount: 0,
  targetDate: null,
  url: null,
  ...fields,
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schemas
// ─────────────────────────────────────────────────────────────────────────────

describe("iouCreateSchema", () => {
  const valid = { amount: 25.5, date: "2026-11-18", direction: "lent", person: " Sara " };

  it("accepts a minimal entry and trims the name", () => {
    const parsed = iouCreateSchema.parse(valid);
    assert.equal(parsed.person, "Sara");
  });

  it("turns an empty note into null", () => {
    assert.equal(iouCreateSchema.parse({ ...valid, description: "  " }).description, null);
  });

  it("rejects bad amounts, dates, directions and unknown keys", () => {
    for (const bad of [
      { ...valid, amount: 0 },
      { ...valid, amount: 10.001 },
      { ...valid, date: "2026-02-30" },
      { ...valid, date: "18/11/2026" },
      { ...valid, direction: "gift" },
      { ...valid, person: "" },
      { ...valid, user_id: "someone-else" },
    ]) {
      assert.equal(iouCreateSchema.safeParse(bad).success, false, JSON.stringify(bad));
    }
  });
});

describe("iouUpdateSchema", () => {
  it("accepts each action", () => {
    for (const ok of [
      { action: "edit", person: "Tom" },
      { action: "payment", amount: 10 },
      { action: "settle" },
      { action: "reopen" },
    ]) {
      assert.ok(iouUpdateSchema.safeParse(ok).success, JSON.stringify(ok));
    }
  });

  it("rejects unknown actions, extra keys and zero payments", () => {
    assert.equal(iouUpdateSchema.safeParse({ action: "forgive" }).success, false);
    assert.equal(iouUpdateSchema.safeParse({ action: "settle", amount: 5 }).success, false);
    assert.equal(iouUpdateSchema.safeParse({ action: "payment", amount: 0 }).success, false);
  });
});

describe("wishlist schemas", () => {
  const valid = { name: "Headphones", price: 279, priority: "high" };

  it("accepts a minimal item; empty link and notes become null", () => {
    const parsed = wishlistCreateSchema.parse({ ...valid, notes: "", url: "" });
    assert.equal(parsed.url, null);
    assert.equal(parsed.notes, null);
  });

  it("only allows http(s) links", () => {
    assert.ok(wishlistCreateSchema.safeParse({ ...valid, url: "https://example.com/x" }).success);
    assert.equal(wishlistCreateSchema.safeParse({ ...valid, url: "javascript:alert(1)" }).success, false);
  });

  it("validates update actions", () => {
    assert.ok(wishlistUpdateSchema.safeParse({ action: "save", amount: -20 }).success);
    assert.equal(wishlistUpdateSchema.safeParse({ action: "save", amount: 0 }).success, false);
    assert.ok(wishlistUpdateSchema.safeParse({ action: "buy", addExpense: true, date: "2026-11-18", paid: 99.99 }).success);
    assert.equal(wishlistUpdateSchema.safeParse({ action: "buy", date: "2026-11-18", paid: 10 }).success, false);
    assert.ok(wishlistUpdateSchema.safeParse({ action: "restore" }).success);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Schemas vs. migration
// ─────────────────────────────────────────────────────────────────────────────

describe("schemas vs. migration", () => {
  const values = (constraint: string) =>
    [...(new RegExp(`${constraint}\\s+CHECK \\((?:[a-z]+) IN \\(([^)]*)\\)\\)`).exec(MIGRATION)?.[1] ?? "").matchAll(/'([a-z]+)'/g)]
      .map((m) => m[1])
      .sort();

  it("uses the same IOU directions and priorities", () => {
    assert.deepEqual(values("ious_direction_values"), [...IOU_DIRECTIONS].sort());
    assert.deepEqual(values("wishlist_priority_values"), [...PRIORITIES].sort());
  });

  it("keeps settled in step with repayments and enables RLS", () => {
    assert.match(MIGRATION, /IF NEW\."paidAmount" >= NEW\.amount THEN/);
    assert.match(MIGRATION, /ALTER TABLE public\.ious ENABLE ROW LEVEL SECURITY/);
    assert.match(MIGRATION, /ALTER TABLE public\.wishlist_items ENABLE ROW LEVEL SECURITY/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. IOUs
// ─────────────────────────────────────────────────────────────────────────────

describe("summarizeIous", () => {
  const today = "2026-11-18";
  const ious = [
    iou({ amount: 120, paidAmount: 40, person: "Sara" }),
    iou({ amount: 25, dueDate: "2026-11-01", person: "tom" }),
    iou({ amount: 10, person: "Tom " }),
    iou({ amount: 300, direction: "borrowed", paidAmount: 100, person: "Mum" }),
    iou({ amount: 80, direction: "borrowed", paidAmount: 80, person: "Sara", settledAt: "2026-10-01T00:00:00Z" }),
  ];
  const summary = summarizeIous(ious, today);

  it("totals what is still outstanding in each direction", () => {
    assert.equal(summary.owedToMe, 80 + 25 + 10);
    assert.equal(summary.iOwe, 200);
    assert.equal(summary.net, 115 - 200);
  });

  it("ignores settled entries and counts overdue ones", () => {
    assert.equal(summary.openCount, 4);
    assert.equal(summary.overdueCount, 1);
    assert.ok(isOverdue(ious[1], today));
    assert.equal(isOverdue(ious[1], "2026-11-01"), false);
  });

  it("groups people case- and space-insensitively, largest balance first", () => {
    assert.deepEqual(
      summary.people.map((p) => [p.person, p.balance, p.openCount]),
      [
        ["Mum", -200, 1],
        ["Sara", 80, 1],
        ["tom", 35, 2],
      ],
    );
  });

  it("adds money in pence (no floating-point drift)", () => {
    const tiny = summarizeIous([iou({ amount: 0.1 }), iou({ amount: 0.2 })], today);
    assert.equal(tiny.owedToMe, 0.3);
    assert.equal(outstanding({ amount: 10.1, paidAmount: 3.05 }), 7.05);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Wishlist
// ─────────────────────────────────────────────────────────────────────────────

describe("wishlist", () => {
  it("totals open items only and caps savings at the price", () => {
    const summary = summarizeWishlist([
      item({ price: 279, savedAmount: 120 }),
      item({ price: 89.99, savedAmount: 200 }),
      item({ price: 140, purchasedAt: "2026-10-30", savedAmount: 140 }),
    ]);
    assert.deepEqual(summary, { openCount: 2, purchasedCount: 1, remaining: 159, saved: 209.99, total: 368.99 });
  });

  it("orders by priority, then target date, with bought items last (newest first)", () => {
    const sorted = sortWishlist([
      item({ name: "low", priority: "low" }),
      item({ name: "bought-old", purchasedAt: "2026-01-01" }),
      item({ name: "high-later", priority: "high", targetDate: "2027-01-01" }),
      item({ name: "high-soon", priority: "high", targetDate: "2026-12-01" }),
      item({ name: "bought-new", purchasedAt: "2026-11-01" }),
      item({ name: "medium", priority: "medium" }),
    ]);
    assert.deepEqual(
      sorted.map((i) => i.name),
      ["high-soon", "high-later", "medium", "low", "bought-new", "bought-old"],
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Month savings
// ─────────────────────────────────────────────────────────────────────────────

describe("monthSavings", () => {
  it("works out saved so far, the projection and safe-to-spend", () => {
    // 30-day month, day 15: £1,200 spent → £2,400 projected.
    const s = monthSavings({ goal: 500, income: 3000, spent: 1200, today: "2026-11-15" });
    assert.equal(s.daysInMonth, 30);
    assert.equal(s.daysElapsed, 15);
    assert.equal(s.daysLeft, 16);
    assert.equal(s.savedSoFar, 1800);
    assert.equal(s.projectedSpend, 2400);
    assert.equal(s.projectedSavings, 600);
    assert.equal(s.safeToSpend, 1300);
    assert.equal(s.safeToSpendPerDay, 81.25);
    assert.equal(s.status, "on-track");
  });

  it("flags at-risk and off-track against the goal", () => {
    assert.equal(monthSavings({ goal: 800, income: 3000, spent: 1200, today: "2026-11-15" }).status, "at-risk");
    assert.equal(monthSavings({ goal: 2000, income: 3000, spent: 1200, today: "2026-11-15" }).status, "off-track");
  });

  it("never reports a negative safe-to-spend", () => {
    const s = monthSavings({ goal: 500, income: 1000, spent: 900, today: "2026-11-20" });
    assert.equal(s.safeToSpend, 0);
    assert.equal(s.safeToSpendPerDay, 0);
  });

  it("works without income (no savings figures) and without a goal (no status)", () => {
    const none = monthSavings({ goal: null, income: null, spent: 50, today: "2026-02-10" });
    assert.equal(none.savedSoFar, null);
    assert.equal(none.safeToSpend, null);
    assert.equal(none.status, null);
    assert.equal(none.daysInMonth, 28);
    assert.equal(monthSavings({ goal: null, income: 2000, spent: 50, today: "2026-02-10" }).status, null);
  });

  it("handles leap years and the last day of the month", () => {
    const s = monthSavings({ goal: null, income: 1000, spent: 290, today: "2028-02-29" });
    assert.equal(s.daysInMonth, 29);
    assert.equal(s.daysLeft, 1);
    assert.equal(s.projectedSpend, 290);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Sample data
// ─────────────────────────────────────────────────────────────────────────────

describe("sample data for the new tables", () => {
  const data = generateSampleData(new Date(2026, 10, 18));

  it("includes open, part-paid, overdue and settled IOUs in both directions", () => {
    assert.ok(data.ious.every((i) => isSampleId(i.id) && i.paidAmount <= i.amount));
    assert.ok(data.ious.some((i) => i.direction === "lent") && data.ious.some((i) => i.direction === "borrowed"));
    assert.ok(data.ious.some((i) => i.paidAmount > 0 && i.paidAmount < i.amount));
    assert.ok(data.ious.some((i) => i.paidAmount === i.amount));
    assert.ok(data.ious.some((i) => i.dueDate !== null && i.dueDate < "2026-11-18" && i.paidAmount < i.amount));
    // Every sample IOU is something the API itself would accept.
    for (const { id: _id, paidAmount: _paid, ...fields } of data.ious) {
      assert.ok(iouCreateSchema.safeParse(fields).success, fields.person);
    }
  });

  it("produces wishlist items that pass the API schema", () => {
    for (const w of data.wishlist) {
      assert.ok(isSampleId(w.id));
      assert.ok(wishlistCreateSchema.safeParse({ name: w.name, price: w.price, priority: w.priority }).success, w.name);
      assert.ok(w.savedAmount <= w.price);
    }
    assert.ok(data.wishlist.some((w) => w.purchasedAt !== null));
  });
});
