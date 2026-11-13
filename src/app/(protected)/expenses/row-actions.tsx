"use client";

import { Row } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExpenseWithDetails } from "@/entities/Expense";

interface RowActionsProps {
  row: Row<ExpenseWithDetails>;
  onEdit?: (expense: ExpenseWithDetails) => void;
  onDelete: (expense: ExpenseWithDetails) => void;
}

export function RowActions({ row, onEdit, onDelete }: RowActionsProps) {
  const expense = row.original;
  const label = expense.description || "expense";

  return (
    <div className="flex items-center justify-end gap-0.5">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(expense)}
          className="text-muted-foreground hover:text-foreground size-8"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="size-3.5" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(expense)}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive size-8"
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
