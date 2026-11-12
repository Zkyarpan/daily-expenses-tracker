"use client";

/**
 * src/components/budgets/DeleteBudgetDialog.tsx
 *
 * Confirmation dialog before permanently deleting a budget.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";

import type { BudgetWithSpending } from "@/entities/Budget";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteBudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budget: BudgetWithSpending | null;
  onConfirm: (id: string) => Promise<void>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function DeleteBudgetDialog({
  open,
  onOpenChange,
  budget,
  onConfirm,
}: DeleteBudgetDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!budget) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm(budget.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete budget?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the{" "}
            <strong>{budget.categoryName}</strong> budget of{" "}
            <strong>{formatCurrency(budget.limitAmount)}</strong> for{" "}
            <strong>
              {MONTH_NAMES[budget.month - 1]} {budget.year}
            </strong>
            . Your expenses will not be affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete budget
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
