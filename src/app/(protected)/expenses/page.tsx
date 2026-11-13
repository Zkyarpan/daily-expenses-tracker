"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { BulkUpdate } from "@/components/expenses/BulkUpdate";
import { DeleteExpenseDialog } from "@/components/expenses/DeleteExpenseDialog";
import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import ExpenseHeader from "@/components/expenses/ExpenseHeader";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ExpensesPageSkeleton } from "@/components/shared/PageSkeletons";
import { Button } from "@/components/ui/button";
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

  // ── Discard local edits ───────────────────────────────────────────────────
  const handleDiscard = () => {
    setLocalExpenses(fetchedData);
    setHasUnsavedChanges(false);
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
    return <ExpensesPageSkeleton />;
  }

  const pageHeader = (
    <PageHeader
      title="Expenses"
      description="Add, edit and review your spending one month at a time. Click any cell in the table to change it."
      actions={
        <>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/import-expenses">
              <Upload className="size-3.5" />
              Import
            </Link>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleOpenCreate}>
            <Plus className="size-3.5" />
            Add expense
          </Button>
        </>
      }
    />
  );

  // ── Fetch error state ──────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <ErrorState
          title="Expenses could not be loaded"
          message={fetchError instanceof Error ? fetchError.message : "Unknown error"}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {pageHeader}

      <ExpenseHeader
        currentMonth={currentMonth}
        currentYear={currentYear}
        data={localExpenses}
        deltaPercent={deltaPercent}
        onMonthYearChange={handleMonthYearChange}
        total={total}
      />

      {/* Selection bar: bulk edit + delete for the ticked rows */}
      {selectedIds.length > 0 && (
        <BulkUpdate onApplyBulkUpdate={handleBulkUpdate} selectedCount={selectedIds.length}>
          <Button
            disabled={isDeleting}
            className="gap-1.5"
            onClick={handleBulkDelete}
            size="sm"
            variant="ghost"
          >
            {isDeleting ? (
              <><Loader2 className="size-3.5 animate-spin" />Deleting…</>
            ) : (
              <><Trash2 className="size-3.5" />Delete {selectedIds.length}</>
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setRowSelection({})}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
        </BulkUpdate>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={localExpenses}
        goToLastPage={goToLastPage}
        isLoading={isLoading}
        onRowSelectionChange={setRowSelection}
        rowSelection={rowSelection}
      />

      {/* Floating save bar — only while there are unsaved edits */}
      {hasUnsavedChanges && (
        <div
          role="status"
          className="bg-popover sticky bottom-4 z-20 mx-auto flex w-full max-w-xl flex-wrap items-center gap-3 rounded-2xl border py-2.5 pr-2.5 pl-4 shadow-[0_16px_40px_-8px_rgb(0_0_0/0.5)] dark:border-white/15"
        >
          <span aria-hidden className="bg-warning size-2 shrink-0 rounded-full" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-medium">Unsaved changes</span>
            <span className="text-muted-foreground hidden sm:inline"> · save to keep your edits</span>
          </p>
          <Button size="sm" variant="ghost" onClick={handleDiscard} disabled={isSaving}>
            Discard
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="size-3.5 animate-spin" />Saving…</>
            ) : (
              <><Save className="size-3.5" />Save changes</>
            )}
          </Button>
        </div>
      )}

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
