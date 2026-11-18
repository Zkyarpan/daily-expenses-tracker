/**
 * src/lib/money/schemas.ts
 *
 * Contract for Lend & borrow (IOUs), the Wishlist and the money overview:
 * request schemas, row types and response types, shared by the API routes
 * (src/app/api/ious, /wishlist, /money) and the UI. Limits mirror the CHECK
 * constraints in supabase/migrations/20261118000000_create_ious_and_wishlist.sql.
 *
 * Pure module — safe on the server, in the browser and in tests.
 */

import { z } from "zod";

export const MONEY_MAX = 10_000_000;

/** Whole pence only (2500, 2500.5 — never 2500.123). */
const isWholePence = (value: number) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

export const moneySchema = z
  .number()
  .positive("Enter an amount above zero.")
  .lt(MONEY_MAX, "That amount is too large.")
  .refine(isWholePence, "Use at most two decimal places.");

/** YYYY-MM-DD that is a real calendar date. */
export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Use a valid date.");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

// ─────────────────────────────────────────────────────────────────────────────
// Lend & borrow
// ─────────────────────────────────────────────────────────────────────────────

export const IOU_DIRECTIONS = ["lent", "borrowed"] as const;
export type IouDirection = (typeof IOU_DIRECTIONS)[number];

const iouFields = {
  amount: moneySchema,
  date: dateKeySchema,
  description: optionalText(200, "The note"),
  direction: z.enum(IOU_DIRECTIONS, "Choose lent or borrowed."),
  dueDate: dateKeySchema.nullable().optional(),
  person: z.string().trim().min(1, "Enter a name.").max(60, "Keep the name under 60 characters."),
};

/** POST /api/ious */
export const iouCreateSchema = z.strictObject(iouFields);
export type IouCreate = z.infer<typeof iouCreateSchema>;

/**
 * PATCH /api/ious/:id — one action per request:
 *  - edit: change any field
 *  - payment: record a (partial) repayment
 *  - settle / reopen: mark fully repaid, or undo that
 */
export const iouUpdateSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("edit"), ...partial(iouFields) }),
  z.strictObject({ action: z.literal("payment"), amount: moneySchema }),
  z.strictObject({ action: z.literal("settle") }),
  z.strictObject({ action: z.literal("reopen") }),
]);
export type IouUpdate = z.infer<typeof iouUpdateSchema>;

export interface Iou {
  amount: number;
  createdAt: string;
  date: string;
  description: string | null;
  direction: IouDirection;
  dueDate: string | null;
  id: string;
  paidAmount: number;
  person: string;
  settledAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

const wishlistFields = {
  categoryId: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1, "Enter what you want to buy.").max(80, "Keep the name under 80 characters."),
  notes: optionalText(300, "Notes"),
  price: moneySchema,
  priority: z.enum(PRIORITIES, "Choose a priority."),
  targetDate: dateKeySchema.nullable().optional(),
  url: z
    .string()
    .trim()
    .max(500, "That link is too long.")
    .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Links must start with http:// or https://")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
};

/** POST /api/wishlist */
export const wishlistCreateSchema = z.strictObject({
  ...wishlistFields,
  savedAmount: z.number().min(0).lt(MONEY_MAX).refine(isWholePence, "Use at most two decimal places.").optional(),
});
export type WishlistCreate = z.infer<typeof wishlistCreateSchema>;

/**
 * PATCH /api/wishlist/:id — one action per request:
 *  - edit: change any field
 *  - save: put money aside (negative takes it back out)
 *  - buy: mark as bought, optionally recording the purchase as an expense
 *  - restore: back on the list (removes the expense recorded when bought)
 */
export const wishlistUpdateSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("edit"), ...partial(wishlistFields) }),
  z.strictObject({
    action: z.literal("save"),
    amount: z
      .number()
      .refine((v) => v !== 0 && Math.abs(v) < MONEY_MAX, "Enter an amount.")
      .refine(isWholePence, "Use at most two decimal places."),
  }),
  z.strictObject({
    action: z.literal("buy"),
    addExpense: z.boolean(),
    date: dateKeySchema,
    paid: moneySchema,
  }),
  z.strictObject({ action: z.literal("restore") }),
]);
export type WishlistUpdate = z.infer<typeof wishlistUpdateSchema>;

export interface WishlistItem {
  categoryId: string;
  createdAt: string;
  expenseId: string | null;
  id: string;
  name: string;
  notes: string | null;
  price: number;
  priority: Priority;
  purchasedAt: string | null;
  savedAmount: number;
  targetDate: string | null;
  url: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Responses
// ─────────────────────────────────────────────────────────────────────────────

/** Returned instead of data when the tables have not been created yet. */
export type SetupRequired = { setupRequired: true };

export interface MonthSavings {
  /** Days in the month that have started (1 … daysInMonth). */
  daysElapsed: number;
  daysInMonth: number;
  daysLeft: number;
  goal: number | null;
  income: number | null;
  /** YYYY-MM */
  month: string;
  /** End-of-month spending at the current daily rate. */
  projectedSpend: number;
  /** income − projectedSpend (null without income). */
  projectedSavings: number | null;
  /** What can still be spent this month while hitting the goal (null without income). */
  safeToSpend: number | null;
  /** safeToSpend spread over the remaining days, today included. */
  safeToSpendPerDay: number | null;
  /** income − spent so far (null without income). */
  savedSoFar: number | null;
  spent: number;
  /** on-track / at-risk / off-track against the goal; null without income+goal. */
  status: "at-risk" | "off-track" | "on-track" | null;
}

export interface IouSummary {
  /** Outstanding money the user owes, by person. */
  iOwe: number;
  /** Positive = others owe the user more than the user owes. */
  net: number;
  openCount: number;
  overdueCount: number;
  owedToMe: number;
  people: PersonBalance[];
}

export interface PersonBalance {
  /** Outstanding from this person (positive = they owe the user). */
  balance: number;
  openCount: number;
  person: string;
}

export interface WishlistSummary {
  openCount: number;
  purchasedCount: number;
  remaining: number;
  saved: number;
  total: number;
}

export interface MoneyOverview {
  ious: IouSummary | null;
  savings: MonthSavings;
  /** true when the IOU / wishlist tables are missing. */
  setupRequired: boolean;
  wishlist: (WishlistSummary & { nextUp: WishlistItem | null }) | null;
}

// ─────────────────────────────────────────────────────────────────────────────

/** z.partial for a plain field map (keeps `.optional()` on every field). */
function partial<T extends Record<string, z.ZodType>>(fields: T) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()])) as {
    [K in keyof T]: z.ZodOptional<T[K]>;
  };
}
