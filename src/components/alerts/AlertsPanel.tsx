/**
 * src/components/alerts/AlertsPanel.tsx
 *
 * Feature 5: Automated Spending Alerts — Slide-out panel
 *
 * Displays all active spending alerts with:
 *  - Unread badge count on the trigger button
 *  - Color-coded rows by threshold (warning = amber, critical/over = red)
 *  - Mark as read on panel open
 *  - Individual dismiss button per alert
 *  - "Dismiss all" and "Mark all read" bulk actions
 *  - Empty state when no alerts exist
 */

"use client";

import { Bell, Check, X } from "lucide-react";

import type { SpendingAlert } from "@/entities/Alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getAlertDescription,
  getAlertTitle,
} from "@/lib/alertCalculation";
import { formatCurrency } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Month name helper
// ---------------------------------------------------------------------------
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMonth(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// ---------------------------------------------------------------------------
// Single alert row
// ---------------------------------------------------------------------------
interface AlertRowProps {
  alert: SpendingAlert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
}

function AlertRow({ alert, onMarkRead, onDismiss }: AlertRowProps) {
  const isDestructive = alert.threshold === "critical" || alert.threshold === "over";

  return (
    <div
      className={`relative rounded-lg border p-3 transition-colors ${
        alert.isRead
          ? "bg-muted/30 border-border"
          : isDestructive
            ? "border-destructive/30 bg-destructive/5"
            : "border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20"
      }`}
    >
      {/* Unread indicator dot */}
      {!alert.isRead && (
        <span
          className={`absolute right-3 top-3 size-2 rounded-full ${
            isDestructive ? "bg-destructive" : "bg-amber-500"
          }`}
          aria-label="Unread alert"
        />
      )}

      {/* Alert header */}
      <div className="flex items-start justify-between gap-2 pr-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{getAlertTitle(alert)}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatMonth(alert.year, alert.month)}
          </p>
        </div>
      </div>

      {/* Alert description */}
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        {getAlertDescription(alert, formatCurrency)}
      </p>

      {/* Actions */}
      <div className="mt-2 flex items-center gap-1">
        {!alert.isRead && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => onMarkRead(alert.id)}
          >
            <Check className="size-3" />
            Mark read
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-6 gap-1 px-2 text-xs"
          onClick={() => onDismiss(alert.id)}
          aria-label={`Dismiss alert for ${alert.categoryName}`}
        >
          <X className="size-3" />
          Dismiss
        </Button>
      </div>
    </div>
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
  const hasAlerts = alerts.length > 0;

  return (
    <Sheet
      onOpenChange={(open) => {
        if (open && onOpen) onOpen();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative size-8 p-0 sm:h-9 sm:w-auto sm:px-3"
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread spending alert${unreadCount === 1 ? "" : "s"}`
              : "Spending alerts"
          }
        >
          <Bell className="size-3.5" />
          <span className="hidden sm:inline sm:ml-1.5">Alerts</span>
          {unreadCount > 0 && (
            <span
              className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full text-[10px] font-bold leading-none"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SheetTitle>Spending Alerts</SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
          </div>
          <SheetDescription>
            Budget threshold notifications — warning at 80%, critical at 100%.
          </SheetDescription>
        </SheetHeader>

        {/* Bulk actions */}
        {hasAlerts && (
          <div className="flex items-center gap-2 border-b pb-3">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onMarkAllAsRead}>
                <Check className="mr-1 size-3" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 text-xs"
              onClick={onDismissAll}
            >
              <X className="mr-1 size-3" />
              Dismiss all
            </Button>
          </div>
        )}

        {/* Alert list */}
        <ScrollArea className="flex-1 py-2">
          {!hasAlerts ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell className="text-muted-foreground mb-3 size-10 opacity-40" />
              <p className="text-sm font-medium">No active alerts</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Alerts appear when spending reaches 80% or 100% of a budget.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertRow
                  key={alert.id}
                  alert={alert}
                  onMarkRead={onMarkAsRead}
                  onDismiss={onDismiss}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
