"use client";

import { useEffect, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  OnChangeFn,
  PaginationState,
  Row,
  RowSelectionState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ReceiptText, Search, X } from "lucide-react";

import { DataTablePagination } from "@/components/expenses/TablePagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DataTableProps<TData extends { id: string | number }, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  isReadOnly?: boolean;
  goToLastPage?: boolean;
  isLoading?: boolean;
  /** Inside another card: use a light border instead of a raised card. */
  embedded?: boolean;
  /**
   * Phones (below `md`) show these list rows instead of the wide table, so
   * nothing scrolls sideways. Return an `<li>`.
   */
  renderMobileRow?: (row: Row<TData>) => React.ReactNode;
}

export function DataTable<TData extends { id: string | number }, TValue>({
  columns,
  data,
  rowSelection: externalSelection,
  onRowSelectionChange,
  isReadOnly = false,
  goToLastPage = false,
  isLoading = false,
  embedded = false,
  renderMobileRow,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });
  // Internal state as fallback
  const [internalSelection, setInternalSelection] = useState({});
  // Use external if provided, otherwise internal
  const rowSelection = externalSelection ?? internalSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalSelection;

  // When goToLastPage changes to true, clear sorting and jump to the last page
  useEffect(() => {
    if (goToLastPage) {
      setSorting([]);
      const lastPage = Math.max(
        0,
        Math.ceil(data.length / pagination.pageSize) - 1,
      );
      setPagination((prev) => ({ ...prev, pageIndex: lastPage }));
    }
  }, [goToLastPage, data.length, pagination.pageSize]);

  // Reset to page 0 when global filter changes
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [globalFilter]);

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.id),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
      sorting,
    },
  });

  const emptyState = (
    <div className="flex flex-col items-center px-4 text-center">
      <span className="bg-muted text-muted-foreground ring-border mb-4 flex size-12 items-center justify-center rounded-xl ring-1">
        <ReceiptText className="size-5" aria-hidden />
      </span>
      <p className="text-base font-semibold">
        {globalFilter ? "No matching expenses" : "No expenses this month"}
      </p>
      <p className="text-muted-foreground mt-1.5 text-sm">
        {globalFilter
          ? "Try a different word, or clear the search."
          : "Use “Add expense” above, or import a bank statement."}
      </p>
    </div>
  );

  const container = embedded
    ? "overflow-hidden rounded-xl border"
    : "bg-card overflow-hidden rounded-2xl shadow-md";
  const rows = table.getRowModel().rows;
  // "Select all" on phones only when the page acts on the selection.
  const selectable =
    !isReadOnly &&
    Boolean(onRowSelectionChange) &&
    table.getAllLeafColumns().some((column) => column.id === "select");

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <Input
          placeholder="Search by note, category, place or amount…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-11 rounded-2xl pr-10 pl-11"
          aria-label="Search expenses"
        />
        {globalFilter && (
          <button
            type="button"
            onClick={() => setGlobalFilter("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {globalFilter && (
        <p className="text-muted-foreground -mt-1 px-1 text-xs" aria-live="polite">
          {table.getFilteredRowModel().rows.length} of {data.length} match &ldquo;{globalFilter}&rdquo;
        </p>
      )}
      {renderMobileRow && (
        <div className={cn(container, "md:hidden")}>
          {selectable && rows.length > 0 && (
            <div className="bg-muted/30 flex h-11 items-center justify-between border-b pr-4 pl-3">
              <label className="flex cursor-pointer items-center gap-3 text-xs font-medium">
                <Checkbox
                  checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                  }
                  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all on this page"
                />
                Select all
              </label>
              <span className="text-muted-foreground text-xs tabular-nums">
                {table.getFilteredRowModel().rows.length}{" "}
                {table.getFilteredRowModel().rows.length === 1 ? "item" : "items"}
              </span>
            </div>
          )}
          {isLoading ? (
            <ul className="divide-y" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </li>
              ))}
            </ul>
          ) : rows.length ? (
            <ul className="divide-y">{rows.map((row) => renderMobileRow(row))}</ul>
          ) : (
            <div className="py-12">{emptyState}</div>
          )}
        </div>
      )}
      <div className={cn(container, renderMobileRow && "hidden md:block")}>
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-muted-foreground h-11 px-2 text-xs font-medium first:pl-5 last:pr-4">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columns.length }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-muted/30 data-[state=selected]:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-2 py-1.5 first:pl-5 last:pr-4">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-14">
                  {emptyState}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {data.length > 0 && (
        <DataTablePagination table={table} showSelectionCount={!isReadOnly} />
      )}
    </div>
  );
}
