/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import { useEffect, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";

import { DatePicker } from "@/components/shared/DatePicker";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category, ExpenseWithDetails, Member, Tag } from "@/entities/Expense";
import { LOCALE_CONFIG } from "@/lib/config";
import { parseLocalDate } from "@/lib/dateUtils";

import { DataTableColumnHeader } from "./column-header";
import { RowActions } from "./row-actions";

/** YYYY-MM-DD in local time (toISOString() is UTC and can shift the day). */
const toLocalISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface CreateColumnsProps {
  members: Member[];
  categories: Category[];
  tags: Tag[];
  onUpdate: (
    id: string,
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
    instantUI?: boolean,
  ) => void;
  onEdit?: (expense: ExpenseWithDetails) => void;
  onDelete: (expense: ExpenseWithDetails) => void;
}

// Inline-edit controls look like plain text until hovered or focused, so the
// table reads cleanly but every cell can still be edited in place.
const GHOST_INPUT =
  "h-8 rounded-lg border border-transparent bg-transparent px-2 text-sm shadow-none dark:bg-transparent hover:border-input hover:bg-muted/40 focus-visible:border-ring focus-visible:bg-background";
const GHOST_SELECT =
  "h-8 w-32 rounded-lg border-transparent bg-transparent px-2 shadow-none dark:bg-transparent dark:hover:bg-muted/40 hover:border-input hover:bg-muted/40 [&_svg]:opacity-0 hover:[&_svg]:opacity-60 focus-visible:[&_svg]:opacity-60 data-[state=open]:[&_svg]:opacity-60";

// Create a separate component for editable cells to maintain local state
const EditableAmountCell = ({
  expense,
  onUpdate,
}: {
  expense: ExpenseWithDetails;
  onUpdate: (
    id: string,
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
  ) => void;
}) => {
  const [value, setValue] = useState(expense.amount.toFixed(2));

  // Show the new amount when it changes outside this cell (refetch, undo…).
  const [syncedAmount, setSyncedAmount] = useState(expense.amount);
  if (syncedAmount !== expense.amount) {
    setSyncedAmount(expense.amount);
    setValue(expense.amount.toFixed(2));
  }

  const handleBlur = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue !== expense.amount) {
      onUpdate(expense.id, "amount", numValue);
      setValue(numValue.toFixed(2));
    } else {
      // Reset to original value if invalid
      setValue(expense.amount.toFixed(2));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="relative w-28">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm">
        {LOCALE_CONFIG.symbol}
      </span>
      <Input
        type="number"
        inputMode="decimal"
        aria-label="Amount"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${GHOST_INPUT} [appearance:textfield] pl-5 font-medium tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        step="0.01"
        min="0"
      />
    </div>
  );
};

const EditableDescriptionCell = ({
  expense,
  onUpdate,
}: {
  expense: ExpenseWithDetails;
  onUpdate: (
    id: string,
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
  ) => void;
}) => {
  const [value, setValue] = useState(expense.description || "");

  // Show the new text when it changes outside this cell (refetch, undo…).
  const [syncedDescription, setSyncedDescription] = useState(expense.description);
  if (syncedDescription !== expense.description) {
    setSyncedDescription(expense.description);
    setValue(expense.description || "");
  }

  const handleBlur = () => {
    if (value !== expense.description) {
      onUpdate(expense.id, "description", value);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      aria-label="Description"
      className={`${GHOST_INPUT} min-w-40 font-medium`}
      placeholder="Add a note…"
    />
  );
};

export const createColumns = ({
  members,
  categories,
  tags,
  onUpdate,
  onEdit,
  onDelete,
}: CreateColumnsProps): ColumnDef<ExpenseWithDetails>[] => {
  return [
    {
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      id: "select",
    },
    {
      accessorKey: "id",
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs tabular-nums">{row.index + 1}</span>
      ),
      header: "#",
    },
    {
      accessorKey: "date",
      cell: ({ row }) => {
        const [dateValue, setDateValue] = useState(
          toLocalISODate(parseLocalDate(row.original.date as unknown as string)),
        );

        useEffect(() => {
          setDateValue(
            toLocalISODate(parseLocalDate(row.original.date as unknown as string)),
          );
        }, [row.original.date]);

        return (
          <DatePicker
            variant="ghost"
            aria-label="Date"
            value={dateValue}
            onChange={(value) => {
              setDateValue(value);
              onUpdate(row.original.id, "date", new Date(value));
            }}
            className="text-muted-foreground w-[8.75rem]"
          />
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Transaction Date" />
      ),
    },
    {
      accessorKey: "description",
      cell: ({ row }) => (
        <EditableDescriptionCell expense={row.original} onUpdate={onUpdate} />
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
    },
    {
      accessorKey: "amount",
      cell: ({ row }) => (
        <EditableAmountCell expense={row.original} onUpdate={onUpdate} />
      ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Amount" />
      ),
    },
    {
      accessorKey: "categoryName",
      cell: ({ row }) => {
        const [value, setValue] = useState(row.original.categoryId || "none");
        useEffect(() => {
          setValue(row.original.categoryId || "none");
        }, [row.original.categoryId]);
        return (
          <Select
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              onUpdate(
                row.original.id,
                "categoryId",
                newValue === "none" ? null : newValue,
              );
            }}
          >
            <SelectTrigger
              className={`${GHOST_SELECT} ${value === "none" ? "text-muted-foreground/70" : ""}`}
            >
              <SelectValue placeholder="Select..." />
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
        );
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Category" />
      ),
    },
    {
      accessorKey: "tagName",
      cell: ({ row }) => {
        const [value, setValue] = useState(row.original.tagId || "none");

        useEffect(() => {
          setValue(row.original.tagId || "none");
        }, [row.original.tagId]);
        return (
          <Select
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              onUpdate(
                row.original.id,
                "tagId",
                newValue === "none" ? null : newValue,
              );
            }}
          >
            <SelectTrigger
              className={`${GHOST_SELECT} ${value === "none" ? "text-muted-foreground/70" : ""}`}
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Location" />;
      },
    },
    {
      accessorKey: "memberName",
      cell: ({ row }) => {
        const [value, setValue] = useState(row.original.memberId || "none");

        useEffect(() => {
          setValue(row.original.memberId || "none");
        }, [row.original.memberId]);
        return (
          <Select
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              onUpdate(
                row.original.id,
                "memberId",
                newValue === "none" ? null : newValue,
              );
            }}
          >
            <SelectTrigger
              className={`${GHOST_SELECT} ${value === "none" ? "text-muted-foreground/70" : ""}`}
            >
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
      header: ({ column }) => {
        return <DataTableColumnHeader column={column} title="Paid by" />;
      },
    },
    {
      cell: ({ row }) => (
        <RowActions row={row} onEdit={onEdit} onDelete={onDelete} />
      ),
      id: "actions",
    },
    {
      accessorKey: "createdAt",
      cell: () => null,
      enableHiding: false,
      header: () => null,
      id: "createdAt",
    },
  ];
};
