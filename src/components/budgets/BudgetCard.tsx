"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BudgetWithSpending } from "@/entities/Budget";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";

interface BudgetCardProps {
  budget: BudgetWithSpending;
  onEdit: (budget: BudgetWithSpending) => void;
  onDelete: (budget: BudgetWithSpending) => void;
}

export function BudgetCard({ budget, onEdit, onDelete }: BudgetCardProps) {
  const isOverBudget = budget.spent > budget.limitAmount;
  const isNearLimit = !isOverBudget && budget.progressPercent >= 80;
  const CategoryIcon = CATEGORY_ICONS_BY_NAME[budget.categoryName];

  // Progress bar color
  const progressColor = isOverBudget
    ? "bg-destructive"
    : isNearLimit
      ? "bg-warning"
      : "bg-primary";

  return (
    <Card className="group flex flex-col shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {/* Header row: category + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {CategoryIcon && (
              <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                <CategoryIcon className="size-3.5" />
              </span>
            )}
            <h3 className="truncate text-sm font-semibold">{budget.categoryName}</h3>
            {(isOverBudget || isNearLimit) && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isOverBudget ? "bg-destructive/10 text-destructive" : "bg-warning/12 text-warning"
                }`}
              >
                {isOverBudget ? "Over" : "Nearly there"}
              </span>
            )}
          </div>

          {/* Always visible on touch screens (no hover there). */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label={`Edit ${budget.categoryName} budget`}
              onClick={() => onEdit(budget)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${budget.categoryName} budget`}
              onClick={() => onDelete(budget)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        {/* Amount row */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Spent
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight">
              {formatCurrency(budget.spent)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Limit
            </p>
            <p className="mt-0.5 text-sm font-medium tabular-nums text-muted-foreground">
              {formatCurrency(budget.limitAmount)}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(budget.progressPercent, 100)}%` }}
              aria-label={`${Math.round(budget.progressPercent)}% of budget used`}
              role="progressbar"
              aria-valuenow={Math.round(budget.progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {Math.round(budget.progressPercent)}% used
            </span>
            <span
              className={`text-xs font-medium ${
                isOverBudget
                  ? "text-destructive"
                  : isNearLimit
                    ? "text-warning"
                    : "text-success"
              }`}
            >
              {isOverBudget
                ? `${formatCurrency(Math.abs(budget.remaining))} over`
                : `${formatCurrency(budget.remaining)} left`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
