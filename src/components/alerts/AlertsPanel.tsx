/**
 * src/components/alerts/AlertsPanel.tsx
 *
 * Feature 5: Automated Spending Alerts — compact pop-over from the header.
 *
 * A small, scrollable panel anchored to the Alerts button (instead of a
 * full-height side sheet), on a raised surface so it reads as floating
 * above the page:
 *  - Unread badge count on the trigger button
 *  - Warning (≥ 80 %) and over-budget (≥ 100 %) rows with icon, badge and meter
 *  - Mark as read / dismiss per alert, plus "Mark all read" and "Clear all"
 *  - Empty state when no alerts exist, and a shortcut to Budgets
 */

"use client";

import { useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { Check, CircleAlert, PiggyBank, TriangleAlert, X } from "lucide-react";
import Link from "next/link";

import { Meter } from "@/components/shared/Meter";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SpendingAlert } from "@/entities/Alert";
import { getAlertDescription, isOverBudget } from "@/lib/alertCalculation";
import { cn, formatCurrency } from "@/lib/utils";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const formatMonth = (year: number, month: number) => `${MONTH_NAMES[month - 1]} ${year}`;

const statusLabel = (alert: SpendingAlert) =>
  alert.threshold === "warning"
    ? "Nearly there"
    : isOverBudget(alert)
      ? "Over budget"
      : "Limit reached";

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------
interface AlertRowProps {
  alert: SpendingAlert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function AlertRow({ alert, onMarkRead, onDismiss }: AlertRowProps) {
  const isCritical = alert.threshold === "critical";
  const Icon = isCritical ? CircleAlert : TriangleAlert;

  return (
    <li
      className={cn(
        "group/alert hover:bg-muted/40 relative flex gap-3 px-4 py-3.5 transition-colors",
        alert.isRead && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          isCritical ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning",
        )}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-sm font-semibold">{alert.categoryName}</p>
              <StatusBadge tone={isCritical ? "critical" : "warning"}>
                {statusLabel(alert)}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {formatMonth(alert.year, alert.month)}
              {!alert.isRead && <span className="text-foreground font-medium"> · New</span>}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground -mt-1 -mr-2 size-7 shrink-0"
            onClick={() => onDismiss(alert.id)}
            aria-label={`Dismiss alert for ${alert.categoryName}`}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        <Meter
          className="mt-2.5"
          size="sm"
          label={`${alert.categoryName} budget used`}
          value={alert.spentAmount}
          max={alert.limitAmount}
          valueText={`${formatCurrency(alert.spentAmount)} of ${formatCurrency(alert.limitAmount)} spent`}
        />
        <p className="text-muted-foreground mt-1.5 text-xs leading-5">
          {getAlertDescription(alert, formatCurrency)}
        </p>

        {!alert.isRead && (
          <button
            type="button"
            onClick={() => onMarkRead(alert.id)}
            className="text-muted-foreground hover:text-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            <Check className="size-3.5" />
            Mark as read
          </button>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AlertsPanel
// ---------------------------------------------------------------------------
interface AlertsPanelProps {
  alerts: SpendingAlert[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  /** Called when the panel opens so alerts can be pre-fetched if needed. */
  onOpen?: () => void;
}

export function AlertsPanel({
  alerts,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onDismiss,
  onDismissAll,
  onOpen,
}: AlertsPanelProps) {
  const [open, setOpen] = useState(false);
  const hasAlerts = alerts.length > 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && onOpen) onOpen();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "relative size-9 p-0 sm:w-auto sm:gap-2 sm:px-3",
            open && "bg-muted text-foreground",
          )}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread spending alert${unreadCount === 1 ? "" : "s"}`
              : "Spending alerts"
          }
        >
          <Bell size={15} weight={unreadCount > 0 ? "fill" : "bold"} className="shrink-0" />
          <span className="hidden text-xs font-medium sm:inline">Alerts</span>
          {unreadCount > 0 && (
            <span
              className="bg-destructive ring-background absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] leading-none font-bold text-white ring-2"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="bg-popover w-[min(380px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border p-0 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.45)] dark:border-white/15 dark:shadow-[0_24px_60px_-8px_rgb(0_0_0/0.85)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Spending alerts</p>
            <p className="text-muted-foreground text-xs">
              {unreadCount > 0 ? `${unreadCount} new` : "Warnings at 80% and 100% of a budget"}
            </p>
          </div>
          {hasAlerts && (
            <div className="flex shrink-0 items-center gap-0.5">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={onMarkAllAsRead}
                >
                  <Check className="size-3.5" />
                  Read all
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 px-2 text-xs"
                onClick={onDismissAll}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* List — scrolls inside the pop-over, the page stays put */}
        <div className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain">
          {hasAlerts ? (
            <ul className="divide-y">
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onMarkRead={onMarkAsRead}
                  onDismiss={onDismiss}
                />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="bg-muted text-muted-foreground ring-border mb-3 flex size-10 items-center justify-center rounded-xl ring-1">
                <Bell size={18} aria-hidden />
              </span>
              <p className="text-sm font-semibold">You&apos;re all clear</p>
              <p className="text-muted-foreground mt-1 max-w-[260px] text-xs leading-5">
                No budget is close to its limit. Alerts appear here when a category reaches
                80% or 100%.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-muted/30 border-t p-2">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center gap-2 text-xs"
            onClick={() => setOpen(false)}
          >
            <Link href="/budgets">
              <PiggyBank className="size-3.5" />
              Manage budgets
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
