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

import { useState } from "react";
import { CircleHelp, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { DatePicker } from "@/components/shared/DatePicker";
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
import { CreateExpenseInput, ExpenseWithDetails } from "@/entities/Expense";
import {
  CATEGORY_ICONS_BY_NAME,
  DEFAULT_CATEGORIES,
  DEFAULT_TAGS,
  LOCALE_CONFIG,
} from "@/lib/config";
import {
  assertValidCreateInput,
  validateAmount,
  validateDate,
  validateDescription,
} from "@/lib/expenseValidation";
import { cn, formatCurrency, getErrorMessage } from "@/lib/utils";

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

/** YYYY-MM-DD in local time (toISOString() converts to UTC and can shift the day). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today when the page shows the current month, otherwise the 1st of that month. */
function defaultDateFor(year: number, month: number): string {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() === month)
    return toISODate(now);
  return toISODate(new Date(year, month, 1));
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
};

// ─── Component ────────────────────────────────────────────────────────────────

type ExpenseFormProps = Omit<ExpenseFormDialogProps, "open">;

function initialDate(
  initialValues: ExpenseWithDetails | undefined,
  year: number,
  month: number,
) {
  if (!initialValues) return defaultDateFor(year, month);
  return initialValues.date instanceof Date
    ? toISODate(initialValues.date)
    : String(initialValues.date).split("T")[0];
}

/**
 * The form body. It mounts each time the dialog opens (Radix unmounts closed
 * content), so state starts from the right values without a reset effect.
 */
function ExpenseForm({
  mode,
  initialValues,
  defaultYear,
  defaultMonth,
  onClose,
  onSave,
}: ExpenseFormProps) {
  const isEdit = mode === "edit" && !!initialValues;

  // ── Form state ──────────────────────────────────────────────────────────────
  const [amount, setAmount] = useState(() =>
    isEdit ? Math.abs(initialValues.amount).toString() : "",
  );
  const [description, setDescription] = useState(() =>
    isEdit ? (initialValues.description ?? "") : "",
  );
  // New expenses default to Grocery, the most common category.
  const [categoryId, setCategoryId] = useState<string>(() =>
    isEdit ? (initialValues.categoryId ?? "none") : "1",
  );
  const [tagId, setTagId] = useState<string>(() =>
    isEdit ? (initialValues.tagId ?? "none") : "none",
  );
  const [date, setDate] = useState<string>(() =>
    initialDate(isEdit ? initialValues : undefined, defaultYear, defaultMonth),
  );
  const [saving, setSaving] = useState(false);

  // ── Field-level errors ──────────────────────────────────────────────────────
  const [amountError, setAmountError] = useState<string | undefined>();
  const [dateError, setDateError] = useState<string | undefined>();
  const [descError, setDescError] = useState<string | undefined>();

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
      toast.error(
        isEdit ? "Failed to update expense" : "Failed to add expense",
        {
          description: msg,
        },
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const today = daysAgo(0);
  const yesterday = daysAgo(1);
  const parsedAmount = parseFloat(amount);

  return (
    <>
      <DialogHeader className="border-b px-6 pt-6 pb-4 text-left">
        <DialogTitle className="text-lg font-semibold tracking-tight">
          {isEdit ? "Edit expense" : "Add expense"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Change anything below, then save."
            : "Amount and date are all you need. The rest is optional."}
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="exp-amount">How much?</Label>
            <div className="relative">
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-medium">
                {LOCALE_CONFIG.symbol}
              </span>
              <Input
                id="exp-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                autoFocus={!isEdit}
                value={amount}
                aria-invalid={!!amountError}
                aria-describedby={amountError ? "exp-amount-error" : undefined}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountError(undefined);
                }}
                onBlur={() => {
                  if (!amount) return;
                  const v = parseFloat(amount);
                  setAmountError(validateAmount(isNaN(v) ? NaN : v));
                }}
                className="h-14 [appearance:textfield] pl-9 text-2xl font-semibold tabular-nums md:text-2xl [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                disabled={saving}
              />
            </div>
            {amountError && (
              <p id="exp-amount-error" className="text-destructive text-xs">
                {amountError}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="exp-date">When?</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Today", value: today },
                { label: "Yesterday", value: yesterday },
              ].map((opt) => (
                <Button
                  key={opt.label}
                  type="button"
                  size="sm"
                  variant={date === opt.value ? "default" : "secondary"}
                  aria-pressed={date === opt.value}
                  className="h-10 rounded-xl px-4"
                  onClick={() => {
                    setDate(opt.value);
                    setDateError(undefined);
                  }}
                  disabled={saving}
                >
                  {opt.label}
                </Button>
              ))}
              <div className="relative min-w-[150px] flex-1">
                <DatePicker
                  id="exp-date"
                  value={date}
                  aria-invalid={!!dateError}
                  presets={false}
                  onChange={(value) => {
                    setDate(value);
                    setDateError(validateDate(value));
                  }}
                  disabled={saving}
                />
              </div>
            </div>
            {dateError && (
              <p className="text-destructive text-xs">{dateError}</p>
            )}
          </div>

          {/* Category */}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm leading-none font-medium">
              Category
            </legend>
            <div
              className="grid grid-cols-3 gap-2"
              role="radiogroup"
              aria-label="Category"
            >
              {DEFAULT_CATEGORIES.map((c) => {
                const Icon = CATEGORY_ICONS_BY_NAME[c.name] ?? CircleHelp;
                const selected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={saving}
                    onClick={() => setCategoryId(selected ? "none" : c.id)}
                    className={cn(
                      "focus-visible:ring-ring/50 flex h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] disabled:opacity-50 sm:h-10 sm:flex-row sm:justify-start sm:gap-2 sm:px-3 sm:text-sm",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:bg-muted hover:text-foreground dark:bg-input/30 bg-transparent",
                    )}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    <span className="max-w-full truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="exp-desc">
              Note{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Input
              id="exp-desc"
              placeholder="e.g. Weekly grocery run"
              maxLength={500}
              value={description}
              aria-invalid={!!descError}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescError(undefined);
              }}
              onBlur={() =>
                setDescError(validateDescription(description || undefined))
              }
              disabled={saving}
            />
            {descError && (
              <p className="text-destructive text-xs">{descError}</p>
            )}
          </div>

          {/* Location / Tag */}
          <div className="space-y-2">
            <Label htmlFor="exp-tag">
              Place{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </Label>
            <Select value={tagId} onValueChange={setTagId} disabled={saving}>
              <SelectTrigger id="exp-tag" className="w-full">
                <SelectValue placeholder="Choose a place" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No place</SelectItem>
                {DEFAULT_TAGS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="bg-muted/30 gap-2 border-t px-6 py-4 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="gap-2 sm:min-w-40">
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              !isEdit && <Plus className="size-4" />
            )}
            {isEdit
              ? "Save changes"
              : parsedAmount > 0
                ? `Add ${formatCurrency(parsedAmount)}`
                : "Add expense"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function ExpenseFormDialog({
  open,
  onClose,
  ...formProps
}: ExpenseFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-card flex max-h-[calc(100svh-2rem)] flex-col gap-0 rounded-2xl p-0 sm:max-w-[460px]">
        <ExpenseForm
          key={formProps.mode === "edit" ? formProps.initialValues?.id : "new"}
          onClose={onClose}
          {...formProps}
        />
      </DialogContent>
    </Dialog>
  );
}
