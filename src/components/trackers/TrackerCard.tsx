// src/components/trackers/TrackerCard.tsx
"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eraser,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tracker } from "@/entities/Tracker";
import { LOCALE_CONFIG } from "@/lib/config";
import { cn, formatCurrency } from "@/lib/utils";

interface TrackerCardProps {
  tracker: Tracker;
  onEdit: (tracker: Tracker) => void;
  onDelete: (id: string) => void;
  onCleanup: (id: string) => void;
  onAddEntry: (tracker: Tracker) => void;
}

const PREVIEW_ROWS = 5;

const signed = (amount: number) =>
  amount < 0 ? `−${formatCurrency(Math.abs(amount))}` : formatCurrency(amount);

const formatDate = (date: Date) =>
  new Date(date).toLocaleDateString(LOCALE_CONFIG.locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Progress line under the balance. Debts and loans start negative, so
 * progress is how much has been paid off; balances that start positive show
 * the change since the start.
 */
function getProgress(initial: number, current: number) {
  if (initial < 0) {
    const paid = Math.min(100, Math.max(0, (1 - Math.abs(current) / Math.abs(initial)) * 100));
    return {
      bar: paid,
      label: current >= 0 ? "Fully paid off" : `${Math.round(paid)}% paid off`,
    };
  }
  if (initial > 0) {
    const change = ((current - initial) / initial) * 100;
    const rounded = Math.round(change * 10) / 10;
    return {
      bar: null,
      label: `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}% since start`,
    };
  }
  return { bar: null, label: "Started from zero" };
}

type ConfirmAction = "cleanup" | "delete" | null;

const TrackerCard = ({ tracker, onEdit, onDelete, onAddEntry, onCleanup }: TrackerCardProps) => {
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [showAll, setShowAll] = useState(false);

  const entries = tracker.entries ?? [];
  const totalIn = entries.reduce((sum, entry) => sum + entry.debit, 0);
  const totalOut = entries.reduce((sum, entry) => sum + entry.credit, 0);
  const isNegative = tracker.currentBalance < 0;
  const progress = getProgress(tracker.initialBalance, tracker.currentBalance);
  const accent = tracker.color ?? "var(--chart-1)";

  // Most recent activity is what people check, so the collapsed view shows
  // the latest rows (still in date order, so the running balance reads down).
  const visibleEntries =
    showAll || entries.length <= PREVIEW_ROWS ? entries : entries.slice(-PREVIEW_ROWS);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <>
      <Card className="h-full gap-0 py-0">
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 sm:px-6 sm:pt-6">
          <span
            aria-hidden
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-tight">{tracker.title}</h3>
            {tracker.description && (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{tracker.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground -mt-1 -mr-2 size-8"
                aria-label={`Actions for ${tracker.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onAddEntry(tracker)}>
                <Plus className="size-4" />
                Add entry
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(tracker)}>
                <Pencil className="size-4" />
                Edit tracker
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConfirm("cleanup")}>
                <Eraser className="size-4" />
                Clear entries
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
                <Trash2 className="size-4" />
                Delete tracker
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Balance */}
        <div className="px-5 pt-5 sm:px-6">
          <p className="text-muted-foreground text-xs font-medium">Current balance</p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold tracking-tight tabular-nums",
              isNegative ? "text-destructive" : "text-foreground",
            )}
            style={{ letterSpacing: "-0.03em" }}
          >
            {signed(tracker.currentBalance)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Started at <span className="tabular-nums">{signed(tracker.initialBalance)}</span>
            {" · "}
            {progress.label}
          </p>
          {progress.bar !== null && (
            <div
              role="progressbar"
              aria-label={`${tracker.title} paid off`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress.bar)}
              className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ backgroundColor: accent, width: `${progress.bar}%` }}
              />
            </div>
          )}
        </div>

        {/* In / out */}
        <div className="mt-5 grid grid-cols-2 gap-2 px-5 sm:px-6">
          <div className="bg-muted/50 rounded-xl px-3 py-2.5">
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <ArrowDownLeft className="text-success size-3.5" aria-hidden />
              Money in
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(totalIn)}</p>
          </div>
          <div className="bg-muted/50 rounded-xl px-3 py-2.5">
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              <ArrowUpRight className="text-destructive size-3.5" aria-hidden />
              Money out
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(totalOut)}</p>
          </div>
        </div>

        {/* Entries */}
        <div className="mt-5 flex-1 px-5 sm:px-6">
          <div className="flex items-baseline justify-between">
            <h4 className="text-sm font-semibold">Entries</h4>
            <span className="text-muted-foreground text-xs">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {entries.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground h-9 font-sans text-xs font-medium hidden sm:table-cell">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 font-sans text-xs font-medium">
                      Description
                    </TableHead>
                    <TableHead className="text-muted-foreground hidden h-9 text-right font-sans text-xs font-medium sm:table-cell">
                      In
                    </TableHead>
                    <TableHead className="text-muted-foreground hidden h-9 text-right font-sans text-xs font-medium sm:table-cell">
                      Out
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 text-right font-sans text-xs font-medium sm:hidden">
                      Change
                    </TableHead>
                    <TableHead className="text-muted-foreground h-9 text-right font-sans text-xs font-medium">
                      Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground hidden font-sans text-xs whitespace-nowrap sm:table-cell">
                        {formatDate(entry.date)}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate font-sans text-xs">
                        {entry.description || "—"}
                        <span className="text-muted-foreground block sm:hidden">
                          {formatDate(entry.date)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                        {entry.debit > 0 ? (
                          <span className="text-success">+{formatCurrency(entry.debit)}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right text-xs tabular-nums sm:table-cell">
                        {entry.credit > 0 ? (
                          <span className="text-destructive">−{formatCurrency(entry.credit)}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums sm:hidden">
                        {entry.debit > 0 && (
                          <span className="text-success block">+{formatCurrency(entry.debit)}</span>
                        )}
                        {entry.credit > 0 && (
                          <span className="text-destructive block">−{formatCurrency(entry.credit)}</span>
                        )}
                        {entry.debit <= 0 && entry.credit <= 0 && (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium tabular-nums">
                        {signed(entry.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground mt-2 rounded-xl border border-dashed py-6 text-center text-sm">
              No entries yet
            </p>
          )}
          {entries.length > PREVIEW_ROWS && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-1 h-8 w-full text-xs"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show latest only" : `Show ${hiddenCount} earlier ${hiddenCount === 1 ? "entry" : "entries"}`}
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pt-4 pb-5 sm:px-6 sm:pb-6">
          <Button variant="secondary" size="sm" className="w-full gap-1.5" onClick={() => onAddEntry(tracker)}>
            <Plus className="size-3.5" />
            Add entry
          </Button>
        </div>
      </Card>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm === "delete" ? `Delete “${tracker.title}”?` : "Clear all entries?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "delete"
                ? "The tracker and all of its entries will be removed. This can't be undone."
                : "Every entry in this tracker will be permanently removed. Use this to start fresh after a quarter or year. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm === "delete") onDelete(tracker.id);
                else onCleanup(tracker.id);
                setConfirm(null);
              }}
            >
              {confirm === "delete" ? "Delete tracker" : "Clear entries"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TrackerCard;
