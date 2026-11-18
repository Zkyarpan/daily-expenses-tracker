"use client";

import { CircleHelp, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { Money } from "@/components/shared/Money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, ExpenseWithDetails, Member } from "@/entities/Expense";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface ExpenseMobileRowProps {
  /** Look-ups so a category/member changed in place shows its new name. */
  categories?: Category[];
  expense: ExpenseWithDetails;
  members?: Member[];
  /** Shows a category picker in the row (import review). */
  onCategoryChange?: (categoryId: string | null) => void;
  onDelete?: (expense: ExpenseWithDetails) => void;
  /** Tapping the row opens the edit form. */
  onEdit?: (expense: ExpenseWithDetails) => void;
  onSelectedChange?: (selected: boolean) => void;
  selected?: boolean;
}

/**
 * One expense as a touch-friendly list row, used instead of the spreadsheet
 * table on phones: icon, description, category · date · who paid, amount.
 * Tap to edit; tick box and "⋮" menu for bulk actions and delete.
 */
export function ExpenseMobileRow({
  categories,
  expense,
  members,
  onCategoryChange,
  onDelete,
  onEdit,
  onSelectedChange,
  selected = false,
}: ExpenseMobileRowProps) {
  const categoryName =
    (expense.categoryId && categories?.find((c) => c.id === expense.categoryId)?.name) ||
    expense.categoryName ||
    "Uncategorized";
  const memberName =
    (expense.memberId && members?.find((m) => m.id === expense.memberId)?.name) || expense.memberName;
  const Icon = CATEGORY_ICONS_BY_NAME[categoryName] ?? CircleHelp;
  const label = expense.description || "Untitled expense";
  const date = parseLocalDate(expense.date as unknown as string).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const body = (
    <>
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", !expense.description && "text-muted-foreground")}>
          {label}
        </span>
        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
          {onCategoryChange ? date : [categoryName, date, memberName].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Money amount={expense.amount} className="shrink-0 text-sm font-semibold" />
    </>
  );

  return (
    <li
      className={cn(
        "flex items-center gap-1 py-1 pr-1 pl-3 transition-colors",
        selected && "bg-primary/5",
      )}
    >
      {onSelectedChange && (
        // Large hit area around the small box, so it's easy to tap.
        <label className="-my-1 flex size-11 shrink-0 cursor-pointer items-center justify-center -ml-3">
          <Checkbox
            checked={selected}
            onCheckedChange={(value) => onSelectedChange(Boolean(value))}
            aria-label={`Select ${label}`}
          />
        </label>
      )}

      {onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(expense)}
          aria-label={`Edit ${label}`}
          className="active:bg-muted/60 flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl py-2 pr-1 text-left"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2">{body}</div>
      )}

      {onCategoryChange && categories && (
        <Select
          value={expense.categoryId || "none"}
          onValueChange={(value) => onCategoryChange(value === "none" ? null : value)}
        >
          <SelectTrigger aria-label={`Category for ${label}`} className="h-9 w-[7.5rem] shrink-0 rounded-lg px-2 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {onDelete &&
        (onEdit ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground size-10 shrink-0"
                aria-label={`More actions for ${label}`}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onSelect={() => onEdit(expense)}>
                <Pencil aria-hidden />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(expense)}>
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive size-10 shrink-0"
            onClick={() => onDelete(expense)}
            aria-label={`Remove ${label}`}
          >
            <Trash2 className="size-4" />
          </Button>
        ))}
    </li>
  );
}
