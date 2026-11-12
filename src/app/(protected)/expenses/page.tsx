"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { BulkUpdate } from "@/components/expenses/BulkUpdate";
import { DeleteExpenseDialog } from "@/components/expenses/DeleteExpenseDialog";
import ExpenseHeader from "@/components/expenses/ExpenseHeader";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateExpenseInput, ExpenseWithDetails } from "@/entities/Expense";
import { useExpenseMutations } from "@/hooks/expenses/useExpenseMutations";
import { useExpenses } from "@/hooks/expenses/useExpenses";
import { useArrowKeyNavigation } from "@/hooks/useArrowKeyNavigation";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_TAGS,
} from "@/lib/config";
import { getErrorMessage, stripExpenseDetails } from "@/lib/utils";

import { createColumns } from "./columns";
import { DataTable } from "./data-table";

const ExpensesPage = () => {
  const currentDate = new Date();
  const [currentMonth, setCurrentMonth] = useState(currentDate.getMonth());
  const [currentYear, setCurrentYear] = useState(currentDate.getFullYear());

  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // ── Server data ────────────────────────────────────────────────────────────
  const { data: fetchedData = [], isLoading, error: fetchError } = useExpenses(
    currentYear,
    currentMonth,
  );

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const { data: prevData = [] } = useExpenses(prevYear, prevMonth);

  // ── Local editing state (spreadsheet mode) ─────────────────────────────────
  const [localExpenses, setLocalExpenses] = useState<ExpenseWithDetails[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [goToLastPage, setGoToLastPage] = useState(false);

  useEffect(() => {
    setLocalExpenses(fetchedData);
    setHasUnsavedChanges(false);
    setGoToLastPage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedData.length, currentMonth, currentYear]);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ExpenseWithDetails | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ExpenseWithDetails | null>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const {
    createFromInput,
    updateFromInput,
    saveAllAsync,
    bulkDeleteAsync,
    delete: deleteExpenseMutation,
    isSaving,
    isDeleting,
  } = useExpenseMutations(currentYear, currentMonth);

  // ── Unsaved-changes guard ──────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ── Month/year navigation ──────────────────────────────────────────────────
  const handleMonthYearChange = (month: number, year: number) => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Discard and switch months?")) return;
    }
    setCurrentMonth(month);
    setCurrentYear(year);
  };

  // ── Spreadsheet inline update ──────────────────────────────────────────────
  const handleUpdate = (
    id: string,
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
  ) => {
    setLocalExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
    setHasUnsavedChanges(true);
  };

  // ── Bulk field update ──────────────────────────────────────────────────────
  const handleBulkUpdate = (
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
  ) => {
    const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    if (selectedIds.length === 0) return;
    setLocalExpenses((prev) =>
      prev.map((e) => (selectedIds.includes(e.id) ? { ...e, [field]: value } : e)),
    );
    setHasUnsavedChanges(true);
    toast.success("Bulk update applied", {
      description: `Updated ${selectedIds.length} ${selectedIds.length === 1 ? "expense" : "expenses"}`,
    });
  };

  // ── Save all (spreadsheet) ─────────────────────────────────────────────────
  const handleSaveAll = async () => {
    try {
      const toSave = localExpenses.map(stripExpenseDetails);
      await saveAllAsync(toSave);
      setHasUnsavedChanges(false);
      toast.success("Changes saved", {
        description: `${toSave.length} ${toSave.length === 1 ? "expense" : "expenses"} updated`,
      });
    } catch (err) {
      toast.error("Failed to save changes", {
        action: { label: "Retry", onClick: handleSaveAll },
        description: getErrorMessage(err, "Please try again"),
      });
    }
  };

  // ── Dialog: open create ────────────────────────────────────────────────────
  const handleOpenCreate = useCallback(() => {
    setEditTarget(undefined);
    setFormDialogOpen(true);
  }, []);

  // ── Dialog: open edit ──────────────────────────────────────────────────────
  const handleOpenEdit = useCallback((expense: ExpenseWithDetails) => {
    setEditTarget(expense);
    setFormDialogOpen(true);
  }, []);

  // ── Dialog: save (create or edit) ─────────────────────────────────────────
  const handleFormSave = async (input: CreateExpenseInput, id?: string) => {
    if (id) {
      // Edit
      await updateFromInput({ id, input });
    } else {
      // Create
      const tempId = crypto.randomUUID();
      await createFromInput({ input, tempId });
    }
  };

  // ── Dialog: open delete confirmation ──────────────────────────────────────
  const handleOpenDelete = useCallback((expense: ExpenseWithDetails) => {
    setDeleteTarget(expense);
  }, []);

  // ── Dialog: confirm delete ─────────────────────────────────────────────────
  const handleConfirmDelete = async (id: string) => {
    // Remove from local optimistic state immediately
    setLocalExpenses((prev) => prev.filter((e) => e.id !== id));
    await deleteExpenseMutation(id);
  };

  // ── Bulk delete ────────────────────────────────────────────────────────────
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error("No expenses selected");
      return;
    }
    if (!confirm(`Delete ${selectedIds.length} ${selectedIds.length === 1 ? "expense" : "expenses"}?`)) return;

    setLocalExpenses((prev) => prev.filter((e) => !selectedIds.includes(e.id)));
    try {
      await bulkDeleteAsync(selectedIds);
      toast.success("Expenses deleted", {
        description: `${selectedIds.length} removed`,
      });
      setRowSelection({});
      setHasUnsavedChanges(false);
    } catch (err) {
      toast.error("Failed to delete expenses", {
        description: getErrorMessage(err, "Please try again"),
      });
    }
  };

  // Arrow-key shortcut still adds via dialog
  useArrowKeyNavigation(handleOpenCreate);

  // ── Totals ─────────────────────────────────────────────────────────────────
  const total = useMemo(
    () => localExpenses.reduce((sum, e) => sum + e.amount, 0),
    [localExpenses],
  );
  const prevTotal = prevData.reduce((s, e) => s + e.amount, 0);
  const deltaPercent = prevTotal === 0 ? null : ((total - prevTotal) / prevTotal) * 100;

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns = useMemo(
    () =>
      createColumns({
        categories: DEFAULT_CATEGORIES,
        members: DEFAULT_MEMBERS,
        onDelete: handleOpenDelete,
        onEdit: handleOpenEdit,
        onUpdate: handleUpdate,
        tags: DEFAULT_TAGS,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mt-2 space-y-4">
        <div className="bg-secondary mb-8 rounded-md px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="my-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    );
  }

  // ── Fetch error state ──────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-destructive font-medium">Failed to load expenses</p>
        <p className="text-muted-foreground text-sm">
          {fetchError instanceof Error ? fetchError.message : "Unknown error"}
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-2">
      <ExpenseHeader
        currentMonth={currentMonth}
        currentYear={currentYear}
        data={localExpenses}
        deltaPercent={deltaPercent}
        onMonthYearChange={handleMonthYearChange}
        total={total}
      />

      {/* Bulk Update strip */}
      {selectedIds.length > 0 && (
        <div className="mb-4">
          <BulkUpdate
            onApplyBulkUpdate={handleBulkUpdate}
            selectedCount={selectedIds.length}
          />
        </div>
      )}

      {/* Unsaved changes banner */}
      {hasUnsavedChanges && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-500">
              You have unsaved changes
            </p>
            <p className="text-muted-foreground text-xs">
              {'Click "Save Changes" to persist your edits'}
            </p>
          </div>
          <Button size="sm" onClick={handleSaveAll} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
            ) : (
              <><Save className="h-4 w-4" />Save Changes</>
            )}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="mb-2">
        <DataTable
          columns={columns}
          data={localExpenses}
          goToLastPage={goToLastPage}
          isLoading={isLoading}
          onRowSelectionChange={setRowSelection}
          rowSelection={rowSelection}
        />
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-end gap-2 border-t p-4">
        {selectedIds.length > 0 && (
          <Button
            disabled={isDeleting}
            className="gap-2"
            onClick={handleBulkDelete}
            size="sm"
            variant="destructive"
          >
            {isDeleting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Deleting…</>
            ) : (
              <><Minus className="h-4 w-4" />Delete {selectedIds.length}</>
            )}
          </Button>
        )}
        <Button
          className="cursor-pointer gap-2"
          disabled={!hasUnsavedChanges || isSaving}
          onClick={handleSaveAll}
          size="sm"
          variant="default"
        >
          {isSaving ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
          ) : (
            <><Save className="h-4 w-4" />Save</>
          )}
        </Button>
        <Button className="cursor-pointer gap-2" onClick={handleOpenCreate} size="sm">
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      {/* Create / Edit dialog */}
      <ExpenseFormDialog
        defaultMonth={currentMonth}
        defaultYear={currentYear}
        initialValues={editTarget}
        mode={editTarget ? "edit" : "create"}
        onClose={() => { setFormDialogOpen(false); setEditTarget(undefined); }}
        onSave={handleFormSave}
        open={formDialogOpen}
      />

      {/* Delete confirmation dialog */}
      <DeleteExpenseDialog
        expense={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        open={deleteTarget !== null}
      />
    </div>
  );
};

export default ExpensesPage;
