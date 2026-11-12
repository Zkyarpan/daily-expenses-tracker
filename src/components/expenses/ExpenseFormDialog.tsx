"use client";

/**
 * ExpenseFormDialog
 *
 * A single dialog that handles both CREATE and EDIT operations.
 * Opened with mode="create" (blank form) or mode="edit" (pre-filled).
 *
 * Validation:
 *  - Amount must be non-zero, finite, ≤ MAX_AMOUNT, at most 2 dp
 *  - Date is required in YYYY-MM-DD format
 *  - Description is optional, max 500 chars
 *
 * Security:
 *  - user_id is NEVER sent from this component; it is enforced by the
 *    Supabase RLS INSERT policy (auth.uid()) on the server side.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreateExpenseInput, ExpenseWithDetails } from "@/entities/Expense";
import {
  assertValidCreateInput,
  validateAmount,
  validateDate,
  validateDescription,
} from "@/lib/expenseValidation";
import { DEFAULT_CATEGORIES, DEFAULT_MEMBERS, DEFAULT_TAGS, LOCALE_CONFIG } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExpenseFormMode = "create" | "edit";

interface ExpenseFormDialogProps {
  open: boolean;
  mode: ExpenseFormMode;
  /** Populated when mode="edit"; undefined when mode="create" */
  initialValues?: ExpenseWithDetails;
  /** The month/year context for new expenses */
  defaultYear: number;
  defaultMonth: number;
  onClose: () => void;
  onSave: (input: CreateExpenseInput, id?: string) => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO(year: number, month: number): string {
  // Default to the first day of the selected month/year
  const d = new Date(year, month, 1);
  return d.toISOString().split("T")[0];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExpenseFormDialog({
  open,
  mode,
  initialValues,
  defaultYear,
  defaultMonth,
  onClose,
  onSave,
}: ExpenseFormDialogProps) {
  const isEdit = mode === "edit";

  // ── Form state ──────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [tagId, setTagId] = useState<string>("none");
  const [memberId, setMemberId] = useState<string>("none");
  const [date, setDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ── Field-level errors ──────────────────────────────────────────────────────
  const [amountError, setAmountError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [descError, setDescError] = useState<string | undefined>();

  // ── Populate when editing ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    if (isEdit && initialValues) {
      setAmount(Math.abs(initialValues.amount).toString());
      setDescription(initialValues.description ?? "");
      setCategoryId(initialValues.categoryId ?? "none");
      setTagId(initialValues.tagId ?? "none");
      setMemberId(initialValues.memberId ?? "none");
      const d = initialValues.date instanceof Date
        ? initialValues.date.toISOString().split("T")[0]
        : String(initialValues.date).split("T")[0];
      setDate(d);
    } else {
      // Reset for create mode
      setAmount("");
      setDescription("");
      setCategoryId("1"); // default to Grocery
      setTagId("none");
      setMemberId("none");
      setDate(todayISO(defaultYear, defaultMonth));
    }

    setAmountError(undefined);
    setDateError(undefined);
    setDescError(undefined);
  }, [open, isEdit, initialValues, defaultYear, defaultMonth]);

  // ── Inline validation ───────────────────────────────────────────────────────
  const validateFields = (): boolean => {
    const numAmount = parseFloat(amount);
    const aErr = validateAmount(isNaN(numAmount) ? NaN : numAmount);
    const dErr = validateDate(date);
    const descErr = validateDescription(description || undefined);

    setAmountError(aErr);
    setDateError(dErr);
    setDescError(descErr);

    return !aErr && !dErr && !descErr;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) return;

    const numAmount = parseFloat(amount);

    const input: CreateExpenseInput = {
      amount: numAmount,
      categoryId: categoryId === "none" ? null : categoryId,
      date,
      description: description.trim() || undefined,
      tagId: tagId === "none" ? null : tagId,
    };

    // Final assertion (belt-and-suspenders — should never throw if validateFields passed)
    try {
      assertValidCreateInput(input);
    } catch (err) {
      toast.error("Validation failed", {
        description: getErrorMessage(err),
      });
      return;
    }

    setSaving(true);
    try {
      await onSave(input, isEdit ? initialValues?.id : undefined);
      toast.success(isEdit ? "Expense updated" : "Expense added", {
        description: `${LOCALE_CONFIG.symbol}${numAmount.toFixed(2)} ${
          description.trim() ? `— ${description.trim()}` : ""
        }`,
      });
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(isEdit ? "Failed to update expense" : "Failed to add expense", {
        description: msg,
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the expense details below."
              : "Fill in the details for your new expense."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm">
                {LOCALE_CONFIG.symbol}
              </span>
              <Input
                id="exp-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountError(undefined);
                }}
                onBlur={() => {
                  const v = parseFloat(amount);
                  setAmountError(validateAmount(isNaN(v) ? NaN : v));
                }}
                className={`pl-7 ${amountError ? "border-destructive" : ""}`}
                disabled={saving}
              />
            </div>
            {amountError && (
              <p className="text-destructive text-xs">{amountError}</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exp-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDateError(undefined);
              }}
              onBlur={() => setDateError(validateDate(date))}
              className={dateError ? "border-destructive" : ""}
              disabled={saving}
            />
            {dateError && (
              <p className="text-destructive text-xs">{dateError}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-desc">Description</Label>
            <Textarea
              id="exp-desc"
              placeholder="e.g. Weekly grocery run"
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescError(undefined);
              }}
              onBlur={() => setDescError(validateDescription(description || undefined))}
              className={`resize-none ${descError ? "border-destructive" : ""}`}
              disabled={saving}
            />
            {descError && (
              <p className="text-destructive text-xs">{descError}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={saving}>
              <SelectTrigger id="exp-category">
                <SelectValue placeholder="Select category…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {DEFAULT_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location / Tag */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-tag">Location</Label>
            <Select value={tagId} onValueChange={setTagId} disabled={saving}>
              <SelectTrigger id="exp-tag">
                <SelectValue placeholder="Select location…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {DEFAULT_TAGS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paid by */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-member">Paid by</Label>
            <Select value={memberId} onValueChange={setMemberId} disabled={saving}>
              <SelectTrigger id="exp-member">
                <SelectValue placeholder="Select member…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {DEFAULT_MEMBERS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
