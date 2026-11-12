"use client";

/**
 * alert-dialog.tsx
 *
 * A lightweight AlertDialog built on top of the existing shadcn/ui Dialog
 * component — no additional Radix package needed.
 *
 * API mirrors the standard shadcn/ui AlertDialog so it can be swapped for
 * the full @radix-ui/react-alert-dialog version at any time.
 */

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Root ─────────────────────────────────────────────────────────────────────

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const AlertDialogContext = React.createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({ open: false, setOpen: () => {} });

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleChange = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, setOpen: handleChange }}>
      <Dialog open={isOpen} onOpenChange={handleChange}>
        {children}
      </Dialog>
    </AlertDialogContext.Provider>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function AlertDialogContent({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogContent>) {
  return (
    <DialogContent className={cn("max-w-md", className)} {...props}>
      {children}
    </DialogContent>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

const AlertDialogHeader = DialogHeader;

// ─── Title ────────────────────────────────────────────────────────────────────

const AlertDialogTitle = DialogTitle;

// ─── Description ─────────────────────────────────────────────────────────────

const AlertDialogDescription = DialogDescription;

// ─── Footer ───────────────────────────────────────────────────────────────────

const AlertDialogFooter = DialogFooter;

// ─── Cancel ───────────────────────────────────────────────────────────────────

interface AlertDialogCancelProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

function AlertDialogCancel({ className, children, ...props }: AlertDialogCancelProps) {
  const { setOpen } = React.useContext(AlertDialogContext);
  return (
    <button
      type="button"
      onClick={() => setOpen(false)}
      className={cn(
        "ring-offset-background focus-visible:ring-ring border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children ?? "Cancel"}
    </button>
  );
}

// ─── Action ───────────────────────────────────────────────────────────────────
// Not exported since callers pass a <Button> directly in the footer.

export {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
};
