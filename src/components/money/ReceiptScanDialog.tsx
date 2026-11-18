"use client";

import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, Lock, RotateCcw, ScanLine, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreateExpenseInput } from "@/entities/Expense";
import { aiApi, prepareReceiptImage } from "@/lib/api/ai";
import { apiErrorMessage } from "@/lib/api/client";
import { localToday } from "@/lib/api/money";
import { DEFAULT_CATEGORIES } from "@/lib/config";
import { markDone } from "@/lib/onboarding/prefs";
import type { ReceiptDraft } from "@/lib/receipts/receipt";
import { formatCurrency } from "@/lib/utils";

import { amountText, MoneyInput, toAmountText } from "./fields";

type Step = { kind: "pick" } | { image: string; kind: "reading" } | { draft: ReceiptDraft; image: string; kind: "review" };

const CONFIDENCE = {
  high: { label: "Read clearly", tone: "success" },
  low: { label: "Please check", tone: "warning" },
  medium: { label: "Mostly clear", tone: "info" },
} as const;

function ScanFlow({ onDone, onSave }: { onDone: () => void; onSave: (input: CreateExpenseInput) => Promise<void> }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ amount: "", categoryId: "4", date: localToday(), description: "" });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    let image: string;
    try {
      image = await prepareReceiptImage(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo couldn’t be opened.");
      return;
    }
    setStep({ image, kind: "reading" });
    try {
      const { receipt } = await aiApi.scanReceipt(image);
      setForm({
        amount: toAmountText(receipt.total),
        categoryId: receipt.categoryId,
        date: receipt.date,
        description: receipt.description,
      });
      setStep({ draft: receipt, image, kind: "review" });
    } catch (err) {
      setError(apiErrorMessage(err));
      setStep({ kind: "pick" });
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const amount = amountText.safeParse(form.amount);
    if (!amount.success) return setError(amount.error.issues[0]?.message ?? "Check the amount.");
    if (!form.description.trim()) return setError("Add a description.");
    if (!form.date) return setError("Choose a date.");
    setSaving(true);
    setError(null);
    try {
      await onSave({
        amount: Number(amount.data),
        categoryId: form.categoryId,
        date: form.date,
        description: form.description.trim().slice(0, 200),
        tagId: null,
      });
      markDone("receipt");
      toast.success("Expense added from your receipt", {
        description: `${form.description.trim()} · ${formatCurrency(Number(amount.data))}`,
      });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pickers = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );

  if (step.kind === "pick") {
    return (
      <div className="space-y-4">
        {pickers}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="hover:bg-muted/50 focus-visible:ring-ring flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-muted flex size-11 items-center justify-center rounded-xl">
              <Camera className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-medium">Take a photo</span>
            <span className="text-muted-foreground text-xs">Uses your camera on a phone</span>
          </button>
          <button
            type="button"
            onClick={() => libraryRef.current?.click()}
            className="hover:bg-muted/50 focus-visible:ring-ring flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <span className="bg-muted flex size-11 items-center justify-center rounded-xl">
              <ImageUp className="size-5" aria-hidden />
            </span>
            <span className="text-sm font-medium">Upload a photo</span>
            <span className="text-muted-foreground text-xs">JPEG, PNG, WebP or a screenshot</span>
          </button>
        </div>
        {error && (
          <p role="alert" className="text-destructive flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          The photo is shrunk and its location data removed on your device, then sent to the AI service only to read
          it. It isn’t stored. You check everything before it’s saved.
        </p>
      </div>
    );
  }

  if (step.kind === "reading") {
    return (
      <div className="flex flex-col items-center gap-4 py-4" role="status" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={step.image} alt="Your receipt" className="max-h-56 rounded-xl border object-contain" />
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Reading your receipt…
        </p>
      </div>
    );
  }

  const { draft } = step;
  const confidence = CONFIDENCE[draft.confidence];
  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <div className="flex gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={step.image} alt="Your receipt" className="h-28 w-20 shrink-0 rounded-lg border object-cover" />
        <div className="min-w-0 space-y-1.5 text-sm">
          <StatusBadge tone={confidence.tone} dot>
            {confidence.label}
          </StatusBadge>
          {draft.merchant && <p className="truncate font-medium">{draft.merchant}</p>}
          {draft.items.length > 0 && (
            <ul className="text-muted-foreground space-y-0.5 text-xs">
              {draft.items.slice(0, 4).map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex justify-between gap-3">
                  <span className="truncate">{item.name}</span>
                  {item.amount !== null && <span className="tabular-nums">{formatCurrency(item.amount)}</span>}
                </li>
              ))}
              {draft.items.length > 4 && <li>+ {draft.items.length - 4} more</li>}
            </ul>
          )}
        </div>
      </div>

      {draft.currency && (
        <p className="bg-warning/10 text-warning rounded-xl px-3 py-2 text-xs">
          This receipt is in {draft.currency}. The app records pounds — convert the amount before saving.
        </p>
      )}
      {draft.total === null && (
        <p className="bg-warning/10 text-warning rounded-xl px-3 py-2 text-xs">The total couldn’t be read — please enter it.</p>
      )}
      {!draft.dateFromReceipt && <p className="text-muted-foreground text-xs">No date found on the receipt, so today is used.</p>}

      <div className="space-y-2">
        <Label htmlFor="receipt-description">Description</Label>
        <Input
          id="receipt-description"
          value={form.description}
          maxLength={200}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="receipt-amount">Amount</Label>
          <MoneyInput id="receipt-amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="receipt-date">Date</Label>
          <Input id="receipt-date" type="date" value={form.date} max={localToday()} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={(categoryId) => setForm((f) => ({ ...f, categoryId }))}>
            <SelectTrigger className="w-full" aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEFAULT_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setStep({ kind: "pick" })} disabled={saving}>
          <RotateCcw className="size-3.5" aria-hidden />
          Another photo
        </Button>
        <Button type="submit" size="sm" disabled={saving} className="gap-1.5">
          {saving && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          Add expense
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ReceiptScanDialog({
  onOpenChange,
  onSave,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onSave: (input: CreateExpenseInput) => Promise<void>;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5" aria-hidden />
            Scan a receipt
          </DialogTitle>
          <DialogDescription>Snap a receipt and AI fills in the expense for you to check.</DialogDescription>
        </DialogHeader>
        {open && <ScanFlow onDone={() => onOpenChange(false)} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}
