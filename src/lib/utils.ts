import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { Expense, ExpenseWithDetails } from "@/entities/Expense";

import {
  CATEGORY_COLORS_BY_NAME,
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_TAGS,
  LOCALE_CONFIG,
} from "./config";
import { parseLocalDate } from "./dateUtils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const stripExpenseDetails = (expense: ExpenseWithDetails): Expense => ({
  amount: expense.amount,
  categoryId: expense.categoryId,
  createdAt: expense.createdAt,
  // Normalise date to ISO string (YYYY-MM-DD) for DB compatibility.
  // expense.date may be a Date object (from transformToExpenseWithDetails) or
  // a string already.
  // The DB `date` column takes the string form, so the value is deliberately
  // a string here; the cast only reconciles it with Expense.date's type.
  date: (expense.date instanceof Date
    ? expense.date.toISOString().split("T")[0]
    : String(expense.date).split("T")[0]) as unknown as Date,
  description: expense.description,
  id: expense.id,
  memberId: expense.memberId,
  tagId: expense.tagId,
  updatedAt: expense.updatedAt,
});

// Helper function to transform raw DB rows (or demo data) to ExpenseWithDetails.
// Normalises date strings → local Date objects, ISO timestamps → Date objects.
export const transformToExpenseWithDetails = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expenses: any[],
): ExpenseWithDetails[] => {
  return expenses.map((expense) => {
    const category = DEFAULT_CATEGORIES.find(
      (c) => c.id === expense.categoryId,
    );
    const tag = DEFAULT_TAGS.find((t) => t.id === expense.tagId);
    const member = DEFAULT_MEMBERS.find((m) => m.id === expense.memberId);
    return {
      ...expense,
      // Normalise date: Supabase returns "YYYY-MM-DD" string; parse as local time.
      date: expense.date ? parseLocalDate(expense.date) : new Date(),
      // Normalise timestamps
      createdAt: expense.createdAt ? new Date(expense.createdAt) : new Date(),
      updatedAt: expense.updatedAt ? new Date(expense.updatedAt) : new Date(),
      categoryName: category?.name || null,
      memberName: member?.fullName || null,
      tagName: tag?.name || null,
    };
  });
};

export const getCategoryColor = (categoryName: string): string => {
  return (
    CATEGORY_COLORS_BY_NAME[
      categoryName as keyof typeof CATEGORY_COLORS_BY_NAME
    ] || "oklch(0.646 0.222 41.116)" // default to chart-1
  );
};

// Constructing an Intl.NumberFormat is far more expensive than calling
// .format(), and these helpers run once per table row on every render, so the
// default formatters are created once and reused.
const CURRENCY_FORMAT: Intl.NumberFormatOptions = {
  currency: LOCALE_CONFIG.currency,
  style: LOCALE_CONFIG.style,
};
const COMPACT_CURRENCY_FORMAT: Intl.NumberFormatOptions = {
  ...CURRENCY_FORMAT,
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
  notation: "compact",
};
const currencyFormatter = new Intl.NumberFormat(LOCALE_CONFIG.locale, CURRENCY_FORMAT);
const compactCurrencyFormatter = new Intl.NumberFormat(
  LOCALE_CONFIG.locale,
  COMPACT_CURRENCY_FORMAT,
);

export const formatCurrency = (
  amount: number,
  options?: Intl.NumberFormatOptions,
) => {
  if (!options) return currencyFormatter.format(amount);
  return new Intl.NumberFormat(LOCALE_CONFIG.locale, {
    ...CURRENCY_FORMAT,
    ...options, // Allow overrides
  }).format(amount);
};

export const formatCurrencyCompact = (
  amount: number,
  options?: Intl.NumberFormatOptions,
) => {
  if (!options) return compactCurrencyFormatter.format(amount);
  return new Intl.NumberFormat(LOCALE_CONFIG.locale, {
    ...COMPACT_CURRENCY_FORMAT,
    ...options,
  }).format(amount);
};

/**
 * Extracts a human-readable message from any thrown value.
 * Handles both standard `Error` instances and Supabase `PostgrestError`
 * objects (which have a `.message` property but are not `instanceof Error`).
 */
export function getErrorMessage(err: unknown, fallback = "Unknown error"): string {
  if (err && typeof err === "object" && "message" in err) {
    const msg = (err as { message: unknown }).message;
    if (typeof msg === "string" && msg.trim().length > 0) return msg;
  }
  return fallback;
}
