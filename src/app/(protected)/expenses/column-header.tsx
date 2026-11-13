import { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
}

/** Sortable column title. The arrow shows the current sort direction. */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "hover:text-foreground -ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium whitespace-nowrap transition-colors",
        sorted ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      aria-label={`Sort by ${title}${sorted ? (sorted === "asc" ? ", ascending" : ", descending") : ""}`}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-50")} aria-hidden />
    </button>
  );
}
