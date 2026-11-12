"use client";

/**
 * DeleteExpenseDialog
 *
 * A proper shadcn/ui AlertDialog that asks the user to confirm before
 * deleting a single expense.  Replaces the previous window.confirm() usage.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { ExpenseWithDetails } from "@/entities/Expense";
import { LOCALE_CONFIG } from "@/lib/config";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

interface DeleteExpenseDialogProps {
  open: boolean;
  expense: ExpenseWithDetails | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
}

export function DeleteExpenseDialog({
  open,
  expense,
  onClose,
  onConfirm,
}: DeleteExpenseDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (!expense) return;
    setDeleting(true);
    try {
      await onConfirm(expense.id);
      toast.success("Expense deleted", {
        description: `${formatCurrency(expense.amount)} removed`,
      });
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error("Failed to delete expense", { description: msg });
    } finally {
      setDeleting(false);
    }
  };

  if (!expense) return null;

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete expense?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the{" "}
            <span className="font-medium">
              {LOCALE_CONFIG.symbol}
              {Math.abs(expense.amount).toFixed(2)}
            </span>{" "}
            {expense.description ? (
              <>
                expense
                {" "}
                <span className="italic">&ldquo;{expense.description}&rdquo;</span>
              </>
            ) : (
              "expense"
            )}{" "}
            dated{" "}
            <span className="font-medium">
              {new Date(expense.date).toLocaleDateString()}
            </span>
            . This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={deleting}
            className="gap-2"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
