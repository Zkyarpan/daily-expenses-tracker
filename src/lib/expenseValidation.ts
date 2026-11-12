/**
 * src/lib/expenseValidation.ts
 *
 * Pure validation helpers for expense financial data.
 * All functions are synchronous and dependency-free (no Supabase, no React).
 *
 * Design decisions:
 *  - Monetary amounts are validated as JavaScript numbers that will be stored
 *    as PostgreSQL NUMERIC(12,2).  We enforce the same bounds here.
 *  - The maximum storable value with NUMERIC(12,2) is 9_999_999_999.99.
 *  - Amount must be non-zero (matches the CHECK constraint in the migration).
 *  - Dates are accepted as Date objects or ISO-8601 strings (YYYY-MM-DD).
 */

import type { CreateExpenseInput, UpdateExpenseInput, ValidationResult } from "@/entities/Expense";

// ---------------------------------------------------------------------------
// Constants — mirror the DB CHECK constraints
// ---------------------------------------------------------------------------

/** Maximum absolute amount storable in NUMERIC(12,2). */
export const MAX_AMOUNT = 9_999_999_999.99;

/** Minimum absolute amount — must be non-zero; we allow fractional cents. */
export const MIN_AMOUNT_ABS = 0.01;

/** Maximum length for the description column. */
export const MAX_DESCRIPTION_LENGTH = 500;

/** ISO date regex — YYYY-MM-DD */
const ISO_DATE_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

// ---------------------------------------------------------------------------
// Individual field validators
// ---------------------------------------------------------------------------

/**
 * Returns an error message if `amount` is invalid, otherwise undefined.
 *
 * Rules:
 *  - Must be a finite number
 *  - Must not be NaN
 *  - |amount| must be ≥ MIN_AMOUNT_ABS  (non-zero)
 *  - |amount| must be ≤ MAX_AMOUNT
 *  - No more than 2 decimal places (mirrors NUMERIC(12,2))
 */
export function validateAmount(amount: unknown): string | undefined {
  if (typeof amount !== "number" || !isFinite(amount) || isNaN(amount)) {
    return "Amount must be a finite number.";
  }
  if (Math.abs(amount) < MIN_AMOUNT_ABS) {
    return "Amount must not be zero.";
  }
  if (Math.abs(amount) > MAX_AMOUNT) {
    return `Amount must not exceed ${MAX_AMOUNT.toLocaleString()}.`;
  }
  // Check for more than 2 decimal places
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  if (Math.abs(Math.abs(amount) - rounded) > Number.EPSILON * 100) {
    return "Amount must have at most 2 decimal places.";
  }
  return undefined;
}

/**
 * Returns an error message if `date` is invalid, otherwise undefined.
 *
 * Accepts:
 *  - a Date object (must be a valid date)
 *  - an ISO-8601 string (YYYY-MM-DD)
 *
 * Rejects:
 *  - null / undefined
 *  - arbitrary string formats
 *  - future dates more than 1 year ahead (soft guard — might be data entry error)
 */
export function validateDate(date: unknown): string | undefined {
  if (date instanceof Date) {
    if (isNaN(date.getTime())) return "Date is invalid.";
    return undefined;
  }
  if (typeof date === "string") {
    if (!ISO_DATE_RE.test(date)) {
      return "Date must be in YYYY-MM-DD format.";
    }
    const parsed = new Date(date + "T00:00:00");
    if (isNaN(parsed.getTime())) return "Date is invalid.";
    return undefined;
  }
  return "Date is required.";
}

/**
 * Returns an error message if `description` is invalid, otherwise undefined.
 * Description is optional — undefined / null are accepted.
 */
export function validateDescription(description: unknown): string | undefined {
  if (description === undefined || description === null) return undefined;
  if (typeof description !== "string") return "Description must be a string.";
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    return `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Composite validators
// ---------------------------------------------------------------------------

/**
 * Validates a CreateExpenseInput object.
 *
 * @returns `{ valid: true }` if all fields pass, or
 *          `{ valid: false, errors: string[] }` listing every problem.
 */
export function validateCreateExpenseInput(input: CreateExpenseInput): ValidationResult {
  const errors: string[] = [];

  const amountErr = validateAmount(input.amount);
  if (amountErr) errors.push(amountErr);

  const dateErr = validateDate(input.date);
  if (dateErr) errors.push(dateErr);

  const descErr = validateDescription(input.description);
  if (descErr) errors.push(descErr);

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Validates an UpdateExpenseInput object.
 * Only validates fields that are present (partial update).
 */
export function validateUpdateExpenseInput(input: UpdateExpenseInput): ValidationResult {
  const errors: string[] = [];

  if (!input.id || typeof input.id !== "string" || input.id.trim() === "") {
    errors.push("Expense ID is required for updates.");
  }

  if (input.amount !== undefined) {
    const amountErr = validateAmount(input.amount);
    if (amountErr) errors.push(amountErr);
  }

  if (input.date !== undefined) {
    const dateErr = validateDate(input.date);
    if (dateErr) errors.push(dateErr);
  }

  if (input.description !== undefined) {
    const descErr = validateDescription(input.description);
    if (descErr) errors.push(descErr);
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/**
 * Throws a TypeError with a formatted message if validation fails.
 * Convenience wrapper for use inside mutation functions.
 */
export function assertValidCreateInput(input: CreateExpenseInput): void {
  const result = validateCreateExpenseInput(input);
  if (!result.valid) {
    throw new TypeError(`Invalid expense data: ${result.errors.join("; ")}`);
  }
}

export function assertValidUpdateInput(input: UpdateExpenseInput): void {
  const result = validateUpdateExpenseInput(input);
  if (!result.valid) {
    throw new TypeError(`Invalid expense update: ${result.errors.join("; ")}`);
  }
}
