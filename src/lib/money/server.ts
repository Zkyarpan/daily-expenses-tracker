/**
 * src/lib/money/server.ts
 *
 * Server-only data access for Lend & borrow and the Wishlist, used by the
 * /api/ious, /api/wishlist and /api/money route handlers. Every query runs
 * with the caller's session (RLS) and also filters on their user id.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { apiError, apiJson } from "@/lib/server/http";
import { isMissingTableError } from "@/lib/supabase/queries";

import type { Iou, IouDirection, Priority, WishlistItem } from "./schemas";

/** The table (or a newer column) does not exist yet — the migration has not been applied. */
export const isSetupError = (error: unknown) =>
  isMissingTableError(error) ||
  (!!error && typeof error === "object" && "code" in error && (error as { code: string }).code === "PGRST204");

export const SETUP_MESSAGE =
  "This feature needs a one-time database setup. Open Lend & borrow or Wishlist and follow “Finish setup”.";

/** GET handlers answer 200 with a flag so the UI can show the setup card. */
export const setupRequiredJson = () => apiJson({ setupRequired: true as const });
/** Write handlers answer 409 with the same flag. */
export const setupRequiredError = () => apiError(409, SETUP_MESSAGE, { setupRequired: true });

const pad = (n: number) => String(n).padStart(2, "0");
export const serverToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The client's local date if it sent a plausible one (±1 day of the server), else the server's. */
export function resolveToday(request: Request): string {
  const value = new URL(request.url).searchParams.get("today");
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return serverToday();
  const diff = Math.abs(new Date(`${value}T12:00:00Z`).getTime() - Date.now());
  return Number.isFinite(diff) && diff < 36 * 3_600_000 ? value : serverToday();
}

const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const day = (v: unknown) => (typeof v === "string" && v ? v.slice(0, 10) : null);

// ─────────────────────────────────────────────────────────────────────────────
// IOUs
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const iouFromRow = (row: any): Iou => ({
  amount: num(row.amount),
  createdAt: String(row.createdAt ?? ""),
  date: day(row.date) ?? "",
  description: str(row.description),
  direction: (row.direction === "borrowed" ? "borrowed" : "lent") as IouDirection,
  dueDate: day(row.dueDate),
  id: String(row.id),
  paidAmount: num(row.paidAmount),
  person: String(row.person ?? ""),
  settledAt: str(row.settledAt),
});

export async function fetchIous(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("ious")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("createdAt", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map(iouFromRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_VALUES: Priority[] = ["high", "medium", "low"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wishlistFromRow = (row: any): WishlistItem => ({
  categoryId: String(row.categoryId ?? "4"),
  createdAt: String(row.createdAt ?? ""),
  expenseId: str(row.expenseId),
  id: String(row.id),
  name: String(row.name ?? ""),
  notes: str(row.notes),
  price: num(row.price),
  priority: PRIORITY_VALUES.includes(row.priority) ? row.priority : "medium",
  purchasedAt: day(row.purchasedAt),
  savedAmount: num(row.savedAmount),
  targetDate: day(row.targetDate),
  url: str(row.url),
});

export async function fetchWishlist(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("createdAt", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map(wishlistFromRow);
}
