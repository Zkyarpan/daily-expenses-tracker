"use client";

/**
 * src/components/budgets/BudgetFormDialog.tsx
 *
 * Dialog for creating or editing a monthly category budget.
 * Validates on the client before submitting; surfaces server errors inline.
 */

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { Budget } from "@/entities/Budget";
import {
  isDuplicateBudget,
  validateBudgetLimit,
  validateCategoryId,
} from "@/lib/budgetValidation";
import { DEFAULT_CATEGORIES } from "@/lib/config";
import { getErrorMessage } from "@/lib/utils";
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, the dialog is in "edit" mode (only limitAmount is editable). */
  budget?: Budget;
  /** The month being viewed (used for pre-fill and duplicate check). 1-based. */
  currentMonth: number;
  /** The year being viewed (used for pre-fill and duplicate check). */
  currentYear: number;
  /** Existing budgets — used for duplicate detection on create. */
  existingBudgets: Budget[];
  onSave: (data: {
    categoryId: string;
    limitAmount: number;
    year: number;
    month: number;
  }) => Promise<void>;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  currentMonth,
  currentYear,
  existingBudgets,
  onSave,
}: BudgetFormDialogProps) {
  const isEditing = !!budget;

  // ── Form state ──────────────────────────────────────────────────────────
  const [categoryId, setCategoryId] = useState<string>(budget?.categoryId ?? "");
  const [limitStr, setLimitStr] = useState<string>(
    budget ? String(budget.limitAmount) : "",
  );
  const [month, setMonth] = useState<number>(budget?.month ?? currentMonth);
  const [year, setYear] = useState<number>(budget?.year ?? currentYear);

  // ── Error state ─────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset when dialog opens / closes or the budget prop changes
  useEffect(() => {
    if (open) {
      setCategoryId(budget?.categoryId ?? "");
      setLimitStr(budget ? String(budget.limitAmount) : "");
      setMonth(budget?.month ?? currentMonth);
      setYear(budget?.year ?? currentYear);
      setErrors({});
      setServerError("");
    }
  }, [open, budget, currentMonth, currentYear]);

  // ── Validation ──────────────────────────────────────────────────────────
  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!isEditing) {
      const catErr = validateCategoryId(categoryId);
      if (catErr) next.categoryId = catErr;
    }

    const limit = parseFloat(limitStr);
    const limitErr = validateBudgetLimit(isNaN(limit) ? limitStr : limit);
    if (limitErr) next.limitAmount = limitErr;

    // Duplicate check (only on create)
    if (!isEditing && !next.categoryId && !next.limitAmount) {
      if (
        isDuplicateBudget(existingBudgets, {
          categoryId,
          limitAmount: limit,
          month,
          year,
        })
      ) {
        next.categoryId = `A budget for this category in ${MONTH_NAMES[month - 1]} ${year} already exists.`;
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setServerError("");
    try {
      await onSave({
        categoryId: isEditing ? budget!.categoryId : categoryId,
        limitAmount: parseFloat(limitStr),
        month: isEditing ? budget!.month : month,
        year: isEditing ? budget!.year : year,
      });
      onOpenChange(false);
    } catch (err) {
      setServerError(getErrorMessage(err, "An unexpected error occurred."));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Years available in the selector (current year ± 2)
  const yearOptions = Array.from(
    { length: 5 },
    (_, i) => currentYear - 2 + i,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Budget" : "Add Budget"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the spending limit for ${
                  DEFAULT_CATEGORIES.find((c) => c.id === budget?.categoryId)
                    ?.name ?? budget?.categoryId
                } in ${MONTH_NAMES[(budget?.month ?? 1) - 1]} ${budget?.year}.`
              : "Set a monthly spending limit for a category."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Category — read-only in edit mode */}
          {isEditing ? (
            <div className="space-y-1">
              <Label>Category</Label>
              <p className="text-sm font-medium">
                {DEFAULT_CATEGORIES.find((c) => c.id === budget?.categoryId)
                  ?.name ?? budget?.categoryId}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="budget-category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger
                  id="budget-category"
                  className={errors.categoryId ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && (
                <p className="text-destructive text-xs">{errors.categoryId}</p>
              )}
            </div>
          )}

          {/* Month & Year — read-only in edit mode */}
          {!isEditing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="budget-month">Month</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
                  <SelectTrigger id="budget-month">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="budget-year">Year</Label>
                <Select
                  value={String(year)}
                  onValueChange={(v) => setYear(Number(v))}
                >
                  <SelectTrigger id="budget-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Limit amount */}
          <div className="space-y-1">
            <Label htmlFor="budget-limit">Spending limit (£)</Label>
            <Input
              id="budget-limit"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="e.g. 300.00"
              value={limitStr}
              onChange={(e) => setLimitStr(e.target.value)}
              className={errors.limitAmount ? "border-destructive" : ""}
            />
            {errors.limitAmount && (
              <p className="text-destructive text-xs">{errors.limitAmount}</p>
            )}
          </div>

          {/* Server-level error */}
          {serverError && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
              {serverError}
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? "Save changes" : "Add budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
