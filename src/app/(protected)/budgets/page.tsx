"use client";

import { useMemo, useState } from "react";
import { AlertCircle, PiggyBank, Plus, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import { AlertBanner } from "@/components/alerts/AlertBanner";
import { BudgetCard } from "@/components/budgets/BudgetCard";
import { BudgetFormDialog } from "@/components/budgets/BudgetFormDialog";
import { DeleteBudgetDialog } from "@/components/budgets/DeleteBudgetDialog";
import MonthYearSelector from "@/components/expenses/MonthYearSelector";
import { useAlerts } from "@/components/providers/context/AlertsContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Budget, BudgetWithSpending } from "@/entities/Budget";
import { useMonthAlertSync } from "@/hooks/alerts/useSpendingAlerts";
import { useBudgetMutations } from "@/hooks/budgets/useBudgetMutations";
import { useBudgets } from "@/hooks/budgets/useBudgets";
import { DEFAULT_CATEGORIES } from "@/lib/config";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function BudgetCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-md" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-1.5 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const month1 = month0 + 1;

  const handleMonthYearChange = (newMonth: number, newYear: number) => {
    setMonth0(newMonth);
    setYear(newYear);
  };

  const {
    data: budgets = [],
    isLoading,
    isError,
    isSuccess,
    isTableMissing,
    error,
  } = useBudgets(year, month1);

  const { create, update, remove } = useBudgetMutations(year, month1);

  // The provider already keeps the current month in sync; this covers the
  // month selected here (a no-op write when it is the current month).
  const { alerts, dismiss: dismissAlert, syncUserId } = useAlerts();
  useMonthAlertSync(syncUserId, year, month1, budgets, isSuccess);
  const currentMonthAlerts = useMemo(
    () => alerts.filter((a) => a.year === year && a.month === month1),
    [alerts, year, month1],
  );

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<BudgetWithSpending | null>(null);

  const handleOpenCreate = () => {
    setEditingBudget(undefined);
    setFormDialogOpen(true);
  };

  const handleOpenEdit = (b: BudgetWithSpending) => {
    setEditingBudget(b);
    setFormDialogOpen(true);
  };

  const handleOpenDelete = (b: BudgetWithSpending) => {
    setDeletingBudget(b);
    setDeleteDialogOpen(true);
  };

  const handleSave = async (data: {
    categoryId: string;
    limitAmount: number;
    year: number;
    month: number;
  }) => {
    if (editingBudget) {
      await update.mutateAsync({ id: editingBudget.id, limitAmount: data.limitAmount });
      toast.success("Budget updated", {
        description: `${
          DEFAULT_CATEGORIES.find((c) => c.id === data.categoryId)?.name ?? data.categoryId
        } limit set to ${formatCurrency(data.limitAmount)}`,
      });
    } else {
      await create.mutateAsync({
        categoryId: data.categoryId,
        limitAmount: data.limitAmount,
        month: data.month,
        year: data.year,
      });
      toast.success("Budget added", {
        description: `${formatCurrency(data.limitAmount)} limit added`,
      });
    }
  };

  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id);
    toast.success("Budget deleted");
  };

  const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalLimit - totalSpent;
  const isOverall = totalSpent > totalLimit && totalLimit > 0;

  const isDemo = !supabase;
  const isReady = !isDemo && !isTableMissing;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ letterSpacing: "-0.025em" }}>
            Monthly Budgets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set spending limits by category and track your progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <MonthYearSelector
            currentMonth={month0}
            currentYear={year}
            onMonthYearChange={handleMonthYearChange}
          />
          {isReady && (
            <Button size="sm" className="gap-1.5" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              Add budget
            </Button>
          )}
        </div>
      </div>

      {/* Summary row */}
      {!isLoading && budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-5">
          <div className="min-w-0 rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total limit
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight sm:text-xl">
              {formatCurrency(totalLimit)}
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Total spent
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight sm:text-xl">
              {formatCurrency(totalSpent)}
            </p>
          </div>
          {/* Over budget reads as a plain figure with a small status line,
              not a large red negative number. */}
          <div className="min-w-0 rounded-lg border border-border/60 bg-card p-3 shadow-sm sm:p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {isOverall ? "Over by" : "Remaining"}
            </p>
            <p className="mt-1.5 text-[15px] font-semibold tabular-nums tracking-tight sm:text-xl">
              {formatCurrency(Math.abs(totalRemaining))}
            </p>
            <p
              className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium ${
                isOverall ? "text-destructive" : "text-success"
              }`}
            >
              <span aria-hidden className={`size-1.5 rounded-full ${isOverall ? "bg-destructive" : "bg-success"}`} />
              {isOverall ? "Over overall" : "On track"}
            </p>
          </div>
        </div>
      )}

      {/* Spending alerts banner */}
      {!isDemo && currentMonthAlerts.length > 0 && (
        <AlertBanner
          alerts={currentMonthAlerts}
          onDismiss={dismissAlert}
        />
      )}

      {/* Demo mode banner */}
      {isDemo && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
              <PiggyBank className="size-6 text-muted-foreground" />
            </div>
            <p className="font-semibold">Budgets require a Supabase connection</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Configure your Supabase credentials in{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>{" "}
              and apply the budgets migration to use this feature.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup state */}
      {!isDemo && isTableMissing && (
        <Card className="border-dashed shadow-none">
          <CardContent className="mx-auto max-w-lg py-14 text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-warning/10">
              <AlertCircle className="size-6 text-warning" />
            </div>
            <p className="font-semibold">Budgets need a one-time database setup</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              The <code className="rounded bg-muted px-1 py-0.5 text-xs">budgets</code> table
              doesn&apos;t exist yet. Open the Supabase SQL Editor, paste the contents of{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/migrations/20240006000000_create_budgets_table.sql
              </code>{" "}
              and click Run. Then reload this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {isError && !isDemo && (
        <Card className="border-destructive/30 shadow-none">
          <CardContent className="flex flex-col items-center py-10 text-center">
            <AlertCircle className="mb-3 size-8 text-destructive" />
            <p className="font-semibold text-destructive">Failed to load budgets</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getErrorMessage(error, "An unexpected error occurred.")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !isDemo && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <BudgetCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && isReady && budgets.length === 0 && (
        <Card className="border-dashed shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <TrendingDown className="size-6 text-primary" />
            </div>
            <p className="font-semibold">
              No budgets for {MONTH_NAMES[month0]} {year}
            </p>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Add a budget to start tracking your spending limits against actual expenses.
            </p>
            <Button className="mt-6 gap-1.5" size="sm" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              Add your first budget
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Budget cards grid */}
      {!isLoading && !isError && !isDemo && budgets.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <BudgetFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        budget={editingBudget}
        currentMonth={month1}
        currentYear={year}
        existingBudgets={budgets}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <DeleteBudgetDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        budget={deletingBudget}
        onConfirm={handleDelete}
      />
    </div>
  );
}
