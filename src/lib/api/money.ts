/**
 * src/lib/api/money.ts
 *
 * Browser client for Lend & borrow, the Wishlist and the money overview.
 * Errors are `ApiError`s (see ./client.ts); `error.setupRequired` means the
 * database tables have not been created yet.
 */

import type {
  Iou,
  IouCreate,
  IouSummary,
  IouUpdate,
  MoneyOverview,
  SetupRequired,
  WishlistCreate,
  WishlistItem,
  WishlistSummary,
  WishlistUpdate,
} from "@/lib/money/schemas";

import { json, request } from "./client";

const pad = (n: number) => String(n).padStart(2, "0");

/** The browser's local date, so "today" and "this month" match the user. */
export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export type IousResponse = { ious: Iou[]; summary: IouSummary } | SetupRequired;
export type WishlistResponse = { items: WishlistItem[]; summary: WishlistSummary } | SetupRequired;

export const isSetupRequired = (value: unknown): value is SetupRequired =>
  !!value && typeof value === "object" && (value as SetupRequired).setupRequired === true;

export const moneyApi = {
  createIou: (input: IouCreate) => request<{ iou: Iou }>("/api/ious", json("POST", input)),
  createWishlistItem: (input: WishlistCreate) => request<{ item: WishlistItem }>("/api/wishlist", json("POST", input)),
  deleteIou: (id: string) => request<{ deleted: true }>(`/api/ious/${encodeURIComponent(id)}`, json("DELETE")),
  deleteWishlistItem: (id: string) =>
    request<{ deleted: true }>(`/api/wishlist/${encodeURIComponent(id)}`, json("DELETE")),
  ious: () => request<IousResponse>(`/api/ious?today=${localToday()}`),
  overview: () => request<MoneyOverview>(`/api/money/overview?today=${localToday()}`),
  setupSql: async () => {
    const response = await fetch("/api/setup/sql", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("The setup SQL could not be loaded.");
    return response.text();
  },
  updateIou: (id: string, update: IouUpdate) =>
    request<{ iou: Iou }>(`/api/ious/${encodeURIComponent(id)}`, json("PATCH", update)),
  updateWishlistItem: (id: string, update: WishlistUpdate) =>
    request<{ expenseCreated: boolean; item: WishlistItem }>(`/api/wishlist/${encodeURIComponent(id)}`, json("PATCH", update)),
  wishlist: () => request<WishlistResponse>("/api/wishlist"),
};
