"use client";

/**
 * src/components/budgets/BudgetCard.tsx
 *
 * Displays a single budget with:
 *  - Category name
 *  - Progress bar (spent / limit)
 *  - Remaining balance (green if under, red if over)
 *  - Edit and Delete action buttons
 */

import { Pencil, Trash2 } from "lucide-react";

import type { BudgetWithSpending } from "@/entities/Budget";
import { CATEGORY_ICONS_BY_NAME } from "@/lib/config";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BudgetCardProps {
  budget: BudgetWithSpending;
  onEdit: (budget: BudgetWithSpending) => void;
  onDelete: (budget: BudgetWithSpending) => void;
}

export function BudgetCard({ budget, onEdit, onDelete }: BudgetCardProps) {
  const isOverBudget = budget.spent > budget.limitAmount;
  const CategoryIcon = CATEGORY_ICONS_BY_NAME[budget.categoryName];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Category name + icon */}
          <div className="flex min-w-0 items-center gap-2">
            {CategoryIcon && (
              <span className="text-muted-foreground shrink-0">
                <CategoryIcon className="h-4 w-4" />
              </span>
            )}
            <h3 className="truncate text-sm font-semibold">
              {budget.categoryName}
            </h3>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={`Edit ${budget.categoryName} budget`}
              onClick={() => onEdit(budget)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-7 w-7"
              aria-label={`Delete ${budget.categoryName} budget`}
              onClick={() => onDelete(budget)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        {/* Amount summary row */}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Spent</span>
          <span className="font-medium">{formatCurrency(budget.spent)}</span>
        </div>

        {/* Progress bar */}
        <Progress
          value={budget.progressPercent}
          className="h-2"
          aria-label={`${Math.round(budget.progressPercent)}% of budget used`}
          // Over-budget: destructive colour via inline style override
          style={
            isOverBudget
              ? ({ "--progress-foreground": "hsl(var(--destructive))" } as React.CSSProperties)
              : undefined
          }
        />

        {/* Limit and remaining */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Limit: {formatCurrency(budget.limitAmount)}
          </span>
          <span
            className={
              isOverBudget
                ? "text-destructive font-semibold"
                : "text-green-600 font-medium dark:text-green-400"
            }
          >
            {isOverBudget
              ? `${formatCurrency(Math.abs(budget.remaining))} over`
              : `${formatCurrency(budget.remaining)} left`}
          </span>
        </div>

        {/* Percentage label */}
        <p className="text-muted-foreground text-xs">
          {Math.round(budget.progressPercent)}% used
        </p>
      </CardContent>
    </Card>
  );
}
