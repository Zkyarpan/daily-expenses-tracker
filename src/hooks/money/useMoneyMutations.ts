"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { moneyApi } from "@/lib/api/money";
import type { IouUpdate, WishlistUpdate } from "@/lib/money/schemas";
import { markDone } from "@/lib/onboarding/prefs";

import { MONEY_KEYS } from "./useMoney";

/** Writes for Lend & borrow and the Wishlist. Every change refreshes the overview too. */
export function useMoneyMutations() {
  const queryClient = useQueryClient();
  const refresh = (key: readonly string[]) => () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: MONEY_KEYS.overview }),
    ]);

  const createIou = useMutation({
    mutationFn: moneyApi.createIou,
    onSuccess: () => {
      markDone("iou");
      return refresh(MONEY_KEYS.ious)();
    },
  });
  const updateIou = useMutation({
    mutationFn: ({ id, update }: { id: string; update: IouUpdate }) => moneyApi.updateIou(id, update),
    onSuccess: refresh(MONEY_KEYS.ious),
  });
  const deleteIou = useMutation({ mutationFn: moneyApi.deleteIou, onSuccess: refresh(MONEY_KEYS.ious) });

  const createWishlistItem = useMutation({
    mutationFn: moneyApi.createWishlistItem,
    onSuccess: () => {
      markDone("wishlist");
      return refresh(MONEY_KEYS.wishlist)();
    },
  });
  const updateWishlistItem = useMutation({
    mutationFn: ({ id, update }: { id: string; update: WishlistUpdate }) => moneyApi.updateWishlistItem(id, update),
    onSuccess: async (result, { update }) => {
      await refresh(MONEY_KEYS.wishlist)();
      // Buying (with an expense) or restoring changes expenses, budgets and charts.
      if (result.expenseCreated || update.action === "restore") {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenses"] }),
          queryClient.invalidateQueries({ queryKey: ["yearly-expenses"] }),
          queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        ]);
      }
    },
  });
  const deleteWishlistItem = useMutation({
    mutationFn: moneyApi.deleteWishlistItem,
    onSuccess: refresh(MONEY_KEYS.wishlist),
  });

  return { createIou, createWishlistItem, deleteIou, deleteWishlistItem, updateIou, updateWishlistItem };
}
