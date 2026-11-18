/**
 * src/components/alerts/AlertBanner.tsx
 *
 * Feature 5: Automated Spending Alerts — Inline banner
 *
 * A compact, dismissible banner shown at the top of pages that have active
 * spending alerts for the current month/year.  Used on the Budgets page and
 * the Dashboard.
 *
 * Shows:
 *  - The count of active alerts
 *  - The most severe threshold (over > critical > warning)
 *  - A link to the Budgets page (on Dashboard)
 *  - Per-category dismiss button
 */

"use client";

import { AlertTriangle, Bell, X } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SpendingAlert } from "@/entities/Alert";
import { getAlertDescription, getAlertTitle, isOverBudget } from "@/lib/alertCalculation";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------
type Severity = "over" | "critical" | "warning";

/** "over" is a critical alert whose spending is above the limit. */
function getHighestSeverity(alerts: SpendingAlert[]): Severity {
  const critical = alerts.filter((a) => a.threshold === "critical");
  if (critical.some(isOverBudget)) return "over";
  if (critical.length > 0) return "critical";
  return "warning";
}

function severityLabel(s: Severity): string {
  switch (s) {
    case "over":     return "Over budget";
    case "critical": return "Budget reached";
    case "warning":  return "Approaching limit";
  }
}

// ---------------------------------------------------------------------------
// AlertBanner
// ---------------------------------------------------------------------------
interface AlertBannerProps {
  alerts: SpendingAlert[];
  onDismiss: (id: string) => void;
  /** When true, shows a "View Budgets" link. */
  showBudgetsLink?: boolean;
}

export function AlertBanner({ alerts, onDismiss, showBudgetsLink = false }: AlertBannerProps) {
  const activeAlerts = alerts.filter((a) => !a.isDismissed);
  if (activeAlerts.length === 0) return null;

  const severity = getHighestSeverity(activeAlerts);
  const isDestructive = severity === "over" || severity === "critical";

  const containerClass = isDestructive
    ? "border-destructive/40 bg-destructive/10 text-destructive"
    : "border-warning/30 bg-warning/10 text-warning";

  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${containerClass}`}
      role="alert"
      aria-live="polite"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isDestructive ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Bell className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {severityLabel(severity)}
              {activeAlerts.length > 1 && ` — ${activeAlerts.length} categories affected`}
            </p>
            {showBudgetsLink && (
              <p className="mt-0.5 text-xs opacity-80">
                <Link href="/budgets" className="underline underline-offset-2 hover:no-underline">
                  View all budgets
                </Link>
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={isDestructive ? "destructive" : "secondary"}
          className={`shrink-0 text-xs ${
            !isDestructive ? "border-warning/30 bg-warning/15 text-warning" : ""
          }`}
        >
          {activeAlerts.length} alert{activeAlerts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Alert rows — limit to 3 to keep the banner compact */}
      <div className="mt-2 space-y-1.5">
        {activeAlerts.slice(0, 3).map((alert) => (
          <div key={alert.id} className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{getAlertTitle(alert)}</p>
              <p className="truncate text-xs opacity-75">
                {getAlertDescription(alert, formatCurrency)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-70 hover:opacity-100"
              onClick={() => onDismiss(alert.id)}
              aria-label={`Dismiss ${alert.categoryName} alert`}
            >
              <X className="size-3" />
            </Button>
          </div>
        ))}

        {activeAlerts.length > 3 && (
          <p className="text-xs opacity-70">
            + {activeAlerts.length - 3} more — open the Alerts panel to see all.
          </p>
        )}
      </div>
    </div>
  );
}
