"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Money } from "@/components/shared/Money";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMoneyMutations } from "@/hooks/money/useMoneyMutations";
import { apiErrorMessage } from "@/lib/api/client";
import { localToday } from "@/lib/api/money";
import type { Iou, WishlistItem } from "@/lib/money/schemas";
import { outstanding } from "@/lib/money/summary";
import { cn, formatCurrency } from "@/lib/utils";

import { amountText, MoneyInput, QuickAmounts, toAmountText } from "./fields";

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Validates a typed amount; returns the number or an error message. */
const parseAmount = (text: string, max?: number): { error: string } | { value: number } => {
  const parsed = amountText.safeParse(text);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter an amount." };
  const value = Number(parsed.data);
  if (max !== undefined && Math.round(value * 100) > Math.round(max * 100)) {
    return { error: `That’s more than ${formatCurrency(max)}.` };
  }
  return { value };
};

function DialogShell({
  children,
  description,
  onOpenChange,
  open,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {open && children}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IOU repayment
// ─────────────────────────────────────────────────────────────────────────────

function PaymentForm({ iou, onDone }: { iou: Iou; onDone: () => void }) {
  const { updateIou } = useMoneyMutations();
  const remaining = outstanding(iou);
  const [text, setText] = useState(toAmountText(remaining));
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = parseAmount(text, remaining);
    if ("error" in result) return setError(result.error);
    try {
      await updateIou.mutateAsync({ id: iou.id, update: { action: "payment", amount: result.value } });
      const settled = Math.round(result.value * 100) === Math.round(remaining * 100);
      toast.success(settled ? `All settled with ${iou.person}` : `${formatCurrency(result.value)} recorded`);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="bg-muted/40 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Still owed</span>
        <Money amount={remaining} className="font-semibold" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="payment-amount">Amount paid back</Label>
        <MoneyInput id="payment-amount" value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-invalid={!!error} />
        <QuickAmounts
          amounts={[
            { label: `All ${formatCurrency(remaining)}`, value: remaining },
            { label: "Half", value: round2(remaining / 2) },
          ]}
          onPick={(v) => setText(toAmountText(v))}
        />
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateIou.isPending} className="gap-1.5">
          {updateIou.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Record payment
        </Button>
      </DialogFooter>
    </form>
  );
}

export function IouPaymentDialog({ iou, onOpenChange }: { iou: Iou | null; onOpenChange: (open: boolean) => void }) {
  return (
    <DialogShell
      open={!!iou}
      onOpenChange={onOpenChange}
      title="Record a payment"
      description={
        iou?.direction === "lent"
          ? `How much did ${iou.person} pay you back?`
          : `How much did you pay ${iou?.person ?? "them"} back?`
      }
    >
      {iou && <PaymentForm iou={iou} onDone={() => onOpenChange(false)} />}
    </DialogShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist: put money aside
// ─────────────────────────────────────────────────────────────────────────────

function SaveForm({ item, onDone }: { item: WishlistItem; onDone: () => void }) {
  const { updateWishlistItem } = useMoneyMutations();
  const remaining = round2(item.price - item.savedAmount);
  const [mode, setMode] = useState<"add" | "remove">(remaining > 0 ? "add" : "remove");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const max = mode === "add" ? remaining : item.savedAmount;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = parseAmount(text, max);
    if ("error" in result) return setError(result.error);
    try {
      const amount = mode === "add" ? result.value : -result.value;
      await updateWishlistItem.mutateAsync({ id: item.id, update: { action: "save", amount } });
      toast.success(mode === "add" ? `${formatCurrency(result.value)} set aside for ${item.name}` : "Savings updated");
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const quick = [10, 25, 50, 100].filter((v) => v < max).map((v) => ({ label: formatCurrency(v), value: v }));
  if (max > 0) quick.push({ label: mode === "add" ? `Rest ${formatCurrency(max)}` : `All ${formatCurrency(max)}`, value: max });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Add or take out">
        {(["add", "remove"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => {
              setMode(value);
              setError(null);
            }}
            disabled={value === "add" ? remaining <= 0 : item.savedAmount <= 0}
            className={cn(
              "focus-visible:ring-ring rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40",
              mode === value ? "border-primary ring-primary bg-muted/40 ring-1" : "text-muted-foreground hover:bg-muted/40",
            )}
          >
            {value === "add" ? "Put money aside" : "Take money out"}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="save-amount">Amount</Label>
        <MoneyInput id="save-amount" value={text} onChange={(e) => setText(e.target.value)} autoFocus aria-invalid={!!error} />
        <QuickAmounts amounts={quick} onPick={(v) => setText(toAmountText(v))} />
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateWishlistItem.isPending} className="gap-1.5">
          {updateWishlistItem.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {mode === "add" ? "Add savings" : "Take out"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WishlistSaveDialog({
  item,
  onOpenChange,
}: {
  item: WishlistItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogShell
      open={!!item}
      onOpenChange={onOpenChange}
      title={item ? `Save for ${item.name}` : "Save"}
      description={
        item ? (
          <>
            <Money amount={item.savedAmount} /> of <Money amount={item.price} /> saved so far.
          </>
        ) : null
      }
    >
      {item && <SaveForm item={item} onDone={() => onOpenChange(false)} />}
    </DialogShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist: mark as bought
// ─────────────────────────────────────────────────────────────────────────────

function BuyForm({ item, onDone }: { item: WishlistItem; onDone: () => void }) {
  const { updateWishlistItem } = useMoneyMutations();
  const [text, setText] = useState(toAmountText(item.price));
  const [date, setDate] = useState(localToday());
  const [addExpense, setAddExpense] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = parseAmount(text);
    if ("error" in result) return setError(result.error);
    if (!date) return setError("Choose the date you bought it.");
    try {
      await updateWishlistItem.mutateAsync({
        id: item.id,
        update: { action: "buy", addExpense, date, paid: result.value },
      });
      toast.success(`Enjoy your ${item.name}!`, {
        description: addExpense ? `${formatCurrency(result.value)} added to your expenses.` : undefined,
      });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="buy-paid">Price paid</Label>
          <MoneyInput id="buy-paid" value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label htmlFor="buy-date">Date</Label>
          <Input id="buy-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <label className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm">
        <Checkbox checked={addExpense} onCheckedChange={(v) => setAddExpense(v === true)} className="mt-0.5" />
        <span>
          <span className="block font-medium">Add it to my expenses</span>
          <span className="text-muted-foreground block text-xs">
            Records the purchase so budgets and charts include it.
          </span>
        </span>
      </label>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={updateWishlistItem.isPending} className="gap-1.5">
          {updateWishlistItem.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Mark as bought
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WishlistBuyDialog({
  item,
  onOpenChange,
}: {
  item: WishlistItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DialogShell open={!!item} onOpenChange={onOpenChange} title="Mark as bought" description={item ? `Did you buy ${item.name}?` : null}>
      {item && <BuyForm item={item} onDone={() => onOpenChange(false)} />}
    </DialogShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm
// ─────────────────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  confirmLabel: string;
  description: React.ReactNode;
  onConfirm: () => Promise<unknown>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      toast.error("That didn’t work", { description: apiErrorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent icon={<Trash2 aria-hidden />}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button type="button" variant="destructive" onClick={confirm} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
