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

  return (
    <div className="flex items-center gap-1">
      {onEdit && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(expense)}
          className="hover:bg-accent h-8 w-8 p-0"
          aria-label="Edit expense"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(expense)}
        className="hover:bg-destructive hover:text-destructive-foreground h-8 w-8 p-0"
        aria-label="Delete expense"
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete</span>
      </Button>
    </div>
  );
}
