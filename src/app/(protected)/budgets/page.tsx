"use client";

/**
 * src/app/(protected)/budgets/page.tsx
 *
 * Feature 4: Monthly Category Budget Management
 * Feature 5: Automated Spending Alerts — per-month banner
 *
 * Shows a responsive grid of budget cards for the selected month/year.
 * Each card displays the spending progress bar and remaining balance.
 * The page supports create, edit, and delete operations via dialogs.
 *
 * NOTE: Requires Supabase to be configured and the migration
 * 20240003000000_create_budgets.sql to be applied.
 * In demo mode (no Supabase) an informational banner is shown.
 */

import { useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
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
import { useSpendingAlerts } from "@/hooks/alerts/useSpendingAlerts";
import { useBudgetMutations } from "@/hooks/budgets/useBudgetMutations";
import { useBudgets } from "@/hooks/budgets/useBudgets";
import { useExpenses } from "@/hooks/expenses/useExpenses";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";
import { formatCurrency, getErrorMessage } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function BudgetCardSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-2 w-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function BudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  // month0 is 0-based (used by MonthYearSelector and useExpenses)
  // month1 is 1-based (used by Budget API)
  const [month0, setMonth0] = useState(now.getMonth());
  const month1 = month0 + 1;

  const handleMonthYearChange = (newMonth: number, newYear: number) => {
    setMonth0(newMonth);
    setYear(newYear);
  };

  // ── Fetch budgets + expenses (for spending calculation) ────────────────
  // useBudgets derives spending from the shared useExpenses query, so budget
  // cards and alerts update when expenses change.
  const {
    data: budgets = [],
    isLoading,
    isError,
    isTableMissing,
    error,
  } = useBudgets(year, month1);

  // Same query useBudgets observes (deduplicated by React Query)
  useExpenses(year, month0);

  const { create, update, remove } = useBudgetMutations(year, month1);

  // ── Spending alerts ────────────────────────────────────────────────────────
  const currentUser = useCurrentUser();
  const { currentMonthAlerts } = useSpendingAlerts(
    currentUser?.id,
    year,
    month1,
    budgets,
  );
  // Also get dismiss from global context for the banner
  const { dismiss: dismissAlert } = useAlerts();

  // ── Dialog state ────────────────────────────────────────────────────────
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBudget, setDeletingBudget] = useState<BudgetWithSpending | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────
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
        description: `${data.categoryId} limit set to ${formatCurrency(data.limitAmount)}`,
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

  // ── Summary totals ───────────────────────────────────────────────────────
  const totalLimit = budgets.reduce((s, b) => s + b.limitAmount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const totalRemaining = totalLimit - totalSpent;
  const isOverall = totalSpent > totalLimit && totalLimit > 0;

  const isDemo = !supabase;
  // Budgets can't be loaded or saved until the budgets table exists.
  const isReady = !isDemo && !isTableMissing;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="bg-secondary rounded-lg p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Monthly Budgets</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Set spending limits by category and track your progress
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthYearSelector
              currentMonth={month0}
              currentYear={year}
              onMonthYearChange={handleMonthYearChange}
            />
            {isReady && (
              <Button size="sm" className="gap-2" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" />
                Add budget
              </Button>
            )}
          </div>
        </div>

        {/* Summary row (only shown when there are budgets) */}
        {!isLoading && budgets.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-6">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Total limit
              </p>
              <p className="text-xl font-bold">{formatCurrency(totalLimit)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Total spent
              </p>
              <p className="text-xl font-bold">{formatCurrency(totalSpent)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide">
                Remaining
              </p>
              <p
                className={`text-xl font-bold ${
                  isOverall
                    ? "text-destructive"
                    : "text-green-600 dark:text-green-400"
                }`}
              >
                {isOverall ? "-" : ""}{formatCurrency(Math.abs(totalRemaining))}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Spending alerts banner — shown when there are active alerts for this month */}
      {!isDemo && currentMonthAlerts.length > 0 && (
        <AlertBanner
          alerts={currentMonthAlerts}
          onDismiss={dismissAlert}
        />
      )}

      {/* Demo mode banner */}
      {isDemo && (
        <Card>
          <CardContent className="py-6 text-center">
            <PiggyBank className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <p className="font-medium">Budgets require a Supabase connection</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure your Supabase credentials in{" "}
              <code className="bg-muted rounded px-1 text-xs">.env.local</code>{" "}
              and apply migration{" "}
              <code className="bg-muted rounded px-1 text-xs">
                20240003000000_create_budgets.sql
              </code>{" "}
              to use this feature.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup state — the budgets table has not been created yet */}
      {!isDemo && isTableMissing && (
        <Card>
          <CardContent className="mx-auto max-w-xl py-10 text-center">
            <PiggyBank className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <p className="font-medium">Budgets need a one-time database setup</p>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              The <code className="bg-muted rounded px-1 text-xs">budgets</code> table
              doesn&apos;t exist in your Supabase project yet. In the Supabase dashboard,
              open <span className="text-foreground font-medium">SQL Editor → New query</span>,
              paste the contents of{" "}
              <code className="bg-muted rounded px-1 text-xs">
                supabase/migrations/20240006000000_create_budgets_table.sql
              </code>{" "}
              and click <span className="text-foreground font-medium">Run</span>. Then
              reload this page. Your expenses are not affected.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {isError && !isDemo && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-destructive font-medium">Failed to load budgets</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {/* Supabase errors are plain objects, not Error instances */}
              {getErrorMessage(error, "An unexpected error occurred.")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && !isDemo && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <BudgetCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && isReady && budgets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <PiggyBank className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
            <p className="font-medium">
              No budgets for {MONTH_NAMES[month0]} {year}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Add a budget to start tracking your spending limits.
            </p>
            <Button className="mt-4 gap-2" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4" />
              Add your first budget
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Budget cards grid */}
      {!isLoading && !isError && !isDemo && budgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
