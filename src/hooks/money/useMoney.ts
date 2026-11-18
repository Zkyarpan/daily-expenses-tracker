"use client";

import { useQuery } from "@tanstack/react-query";

import { moneyApi } from "@/lib/api/money";
import { getIsDemoMode } from "@/lib/supabase";

export const MONEY_KEYS = {
  all: ["money"] as const,
  ious: ["money", "ious"] as const,
  overview: ["money", "overview"] as const,
  wishlist: ["money", "wishlist"] as const,
};

const enabled = !getIsDemoMode();

/** Lend & borrow entries and totals (GET /api/ious). */
export const useIous = () => useQuery({ enabled, queryFn: moneyApi.ious, queryKey: MONEY_KEYS.ious });

/** Wishlist items and totals (GET /api/wishlist). */
export const useWishlist = () => useQuery({ enabled, queryFn: moneyApi.wishlist, queryKey: MONEY_KEYS.wishlist });

/** Savings this month + IOU and wishlist summaries (GET /api/money/overview). */
export const useMoneyOverview = () =>
  useQuery({ enabled, queryFn: moneyApi.overview, queryKey: MONEY_KEYS.overview, staleTime: 30_000 });
