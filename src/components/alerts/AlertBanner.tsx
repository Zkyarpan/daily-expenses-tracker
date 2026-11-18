/**
 * src/components/alerts/AlertBanner.tsx
 *
 * Feature 5: Automated Spending Alerts — inline summary
 *
 * A calm, card-style summary shown on the Dashboard and Budgets page when
 * budgets are close to or over their limit. Colour is used sparingly — a
 * status chip and the meters — so the message reads as guidance, not a
 * warning siren. Each category shows how far over/under it is in words and
 * on a meter, with a one-tap dismiss.
 */

"use client";

import { AlertTriangle, ArrowRight, Bell, CircleAlert, X } from "lucide-react";
import Link from "next/link";

import { Meter } from "@/components/shared/Meter";
import { Button } from "@/components/ui/button";
import type { SpendingAlert } from "@/entities/Alert";
import { isOverBudget } from "@/lib/alertCalculation";
import { cn, formatCurrency } from "@/lib/utils";

type Severity = "over" | "critical" | "warning";

/** "over" is a critical alert whose spending is above the limit. */
function getHighestSeverity(alerts: SpendingAlert[]): Severity {
  const critical = alerts.filter((a) => a.threshold === "critical");
  if (critical.some(isOverBudget)) return "over";
  if (critical.length > 0) return "critical";
  return "warning";
}

const SEVERITY = {
  critical: {
    chip: "bg-warning/12 text-warning",
    icon: CircleAlert,
    label: "Limit reached",
    lead: "You’ve used your whole budget",
  },
  over: {
    chip: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
    label: "Over budget",
    lead: "Some budgets have gone over",
  },
  warning: {
    chip: "bg-warning/12 text-warning",
    icon: Bell,
    label: "Nearly there",
    lead: "Some budgets are close to their limit",
  },
} as const;

/** Plain-English status for one category. */
function statusLine(alert: SpendingAlert): { text: string; tone: "critical" | "warning" } {
  const difference = Math.abs(alert.limitAmount - alert.spentAmount);
  if (isOverBudget(alert)) return { text: `${formatCurrency(difference)} over`, tone: "critical" };
  if (alert.threshold === "critical") return { text: "Limit reached", tone: "warning" };
  return { text: `${formatCurrency(difference)} left`, tone: "warning" };
}

interface AlertBannerProps {
  alerts: SpendingAlert[];
  onDismiss: (id: string) => void;
  /** When true, shows a "Review budgets" link. */
  showBudgetsLink?: boolean;
}

export function AlertBanner({ alerts, onDismiss, showBudgetsLink = false }: AlertBannerProps) {
  const activeAlerts = alerts.filter((a) => !a.isDismissed);
  if (activeAlerts.length === 0) return null;

  const severity = getHighestSeverity(activeAlerts);
  const { chip, icon: Icon, label, lead } = SEVERITY[severity];
  // Most urgent first: over budget, then by how much of the limit is used.
  const sorted = [...activeAlerts].sort(
    (a, b) => Number(isOverBudget(b)) - Number(isOverBudget(a)) || b.spentPercent - a.spentPercent,
  );

  return (
    <section
      aria-label="Budget alerts"
      aria-live="polite"
      className="bg-card rounded-2xl p-4 shadow-md sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", chip)}>
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {lead}
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", chip)}>
                {label}
                {activeAlerts.length > 1 && ` · ${activeAlerts.length}`}
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              A small change this week keeps the month on track. Alerts appear at 80% and 100% of a limit.
            </p>
          </div>
        </div>
        {showBudgetsLink && (
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
            <Link href="/budgets">
              Review budgets
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        )}
      </div>

      {/* One row per category — at most 3 to keep it compact */}
      <ul className="mt-4 space-y-3">
        {sorted.slice(0, 3).map((alert) => {
          const status = statusLine(alert);
          return (
            <li key={alert.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{alert.categoryName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatCurrency(alert.spentAmount)} of {formatCurrency(alert.limitAmount)}
                    <span
                      className={cn(
                        "ml-2 font-medium",
                        status.tone === "critical" ? "text-destructive" : "text-warning",
                      )}
                    >
                      {status.text}
                    </span>
                  </span>
                </div>
                <Meter
                  size="sm"
                  label={`${alert.categoryName} budget used`}
                  value={alert.spentAmount}
                  max={alert.limitAmount}
                  valueText={`${formatCurrency(alert.spentAmount)} of ${formatCurrency(alert.limitAmount)} (${Math.round(alert.spentPercent)}%)`}
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground size-8 shrink-0"
                onClick={() => onDismiss(alert.id)}
                aria-label={`Dismiss ${alert.categoryName} alert`}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>

      {activeAlerts.length > 3 && (
        <p className="text-muted-foreground mt-3 text-xs">
          + {activeAlerts.length - 3} more in the alerts panel (bell icon at the top).
        </p>
      )}
    </section>
  );
}
