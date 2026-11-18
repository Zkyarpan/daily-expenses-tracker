"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import type { CreateExpenseInput } from "@/entities/Expense";
import { useExpenseMutations } from "@/hooks/expenses/useExpenseMutations";
import { useIous } from "@/hooks/money/useMoney";
import { isSetupRequired } from "@/lib/api/money";
import type { Iou, IouDirection, WishlistItem } from "@/lib/money/schemas";

import { IouFormDialog } from "./IouFormDialog";
import { ReceiptScanDialog } from "./ReceiptScanDialog";
import { WishlistFormDialog } from "./WishlistFormDialog";

interface QuickAdd {
  openExpense: () => void;
  /** New entry in `direction`, or edit `iou`. */
  openIou: (options?: { direction?: IouDirection; iou?: Iou }) => void;
  /** Photo of a receipt → AI reads it → expense. */
  openReceiptScan: () => void;
  /** New item, or edit `item`. */
  openWishlist: (options?: { item?: WishlistItem }) => void;
}

const QuickAddContext = createContext<QuickAdd | null>(null);

export const useQuickAdd = () => {
  const value = useContext(QuickAddContext);
  if (!value) throw new Error("useQuickAdd must be used inside <QuickAddProvider>");
  return value;
};

/**
 * One place that owns the "add" dialogs for expenses, lend & borrow and the
 * wishlist, so the header's "+ New" menu, Home and the feature pages all open
 * the same dialogs. Mounted by the protected layout.
 */
export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [iouState, setIouState] = useState<{ direction: IouDirection; iou?: Iou; open: boolean }>({
    direction: "lent",
    open: false,
  });
  const [wishState, setWishState] = useState<{ item?: WishlistItem; open: boolean }>({ open: false });

  const { createFromInput } = useExpenseMutations(now.getFullYear(), now.getMonth());
  const ious = useIous();
  const people = useMemo(() => {
    const data = ious.data;
    if (!data || isSetupRequired(data)) return [];
    return [...new Set(data.ious.map((i) => i.person.trim()))].sort((a, b) => a.localeCompare(b));
  }, [ious.data]);

  // State setters are stable; listed so the React Compiler can keep these memoised.
  const openExpense = useCallback(() => setExpenseOpen(true), [setExpenseOpen]);
  const openReceiptScan = useCallback(() => setScanOpen(true), [setScanOpen]);
  const openIou = useCallback(
    (options?: { direction?: IouDirection; iou?: Iou }) =>
      setIouState({ direction: options?.iou?.direction ?? options?.direction ?? "lent", iou: options?.iou, open: true }),
    [setIouState],
  );
  const openWishlist = useCallback(
    (options?: { item?: WishlistItem }) => setWishState({ item: options?.item, open: true }),
    [setWishState],
  );

  const value = useMemo(
    () => ({ openExpense, openIou, openReceiptScan, openWishlist }),
    [openExpense, openIou, openReceiptScan, openWishlist],
  );

  const saveExpense = async (input: CreateExpenseInput) => {
    await createFromInput({ input, tempId: crypto.randomUUID() });
  };

  return (
    <QuickAddContext.Provider value={value}>
      {children}

      <ExpenseFormDialog
        defaultMonth={now.getMonth()}
        defaultYear={now.getFullYear()}
        mode="create"
        onClose={() => setExpenseOpen(false)}
        onSave={saveExpense}
        open={expenseOpen}
      />
      <ReceiptScanDialog open={scanOpen} onOpenChange={setScanOpen} onSave={saveExpense} />
      <IouFormDialog
        direction={iouState.direction}
        iou={iouState.iou}
        open={iouState.open}
        onOpenChange={(open) => setIouState((s) => ({ ...s, open }))}
        people={people}
      />
      <WishlistFormDialog
        item={wishState.item}
        open={wishState.open}
        onOpenChange={(open) => setWishState((s) => ({ ...s, open }))}
      />
    </QuickAddContext.Provider>
  );
}
