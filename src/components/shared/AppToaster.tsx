"use client";

import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

import { cn } from "@/lib/utils";

/**
 * App-wide notification pop-ups (Sonner), mounted once in the root layout so
 * every page — sign-in and sign-up included — uses the same design:
 * a tinted icon tile, a coloured accent bar per type, title + description,
 * optional action/cancel buttons and a close button.
 *
 * Use it with Sonner's API anywhere: `toast.success("Saved", { description })`,
 * `toast.error(…)`, `toast.warning(…)`, `toast.info(…)`, `toast.loading(…)`.
 * Toasts are announced to screen readers (aria-live) and pause on hover.
 */

function Tile({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn("flex size-8 items-center justify-center rounded-xl [&_svg]:size-[18px]", className)}>{children}</span>
  );
}

const ICONS = {
  close: <X className="size-3.5" aria-hidden />,
  error: (
    <Tile className="bg-destructive/12 text-destructive">
      <CircleAlert aria-hidden />
    </Tile>
  ),
  info: (
    <Tile className="bg-primary/12 text-primary">
      <Info aria-hidden />
    </Tile>
  ),
  loading: (
    <Tile className="bg-primary/12 text-primary">
      <Loader2 className="animate-spin" aria-hidden />
    </Tile>
  ),
  success: (
    <Tile className="bg-success/12 text-success">
      <CircleCheck aria-hidden />
    </Tile>
  ),
  warning: (
    <Tile className="bg-warning/15 text-warning">
      <TriangleAlert aria-hidden />
    </Tile>
  ),
};

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      // Just below the 64 px sticky top bar; full width on phones.
      offset={{ right: 24, top: 80 }}
      mobileOffset={{ left: 12, right: 12, top: 76 }}
      gap={12}
      visibleToasts={4}
      duration={5000}
      closeButton
      icons={ICONS}
      // Sonner sizes its container from --width; toasts fill it.
      style={{ "--width": "384px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          actionButton:
            "bg-primary! text-primary-foreground! hover:bg-primary/90! h-8! shrink-0 self-center rounded-full! px-3.5! text-xs! font-semibold! transition-colors",
          cancelButton: "bg-muted! text-foreground! h-8! shrink-0 self-center rounded-full! px-3! text-xs! font-medium!",
          closeButton:
            "absolute! top-2.5! right-2.5! left-auto! size-7! transform-none! rounded-full! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground! transition-colors",
          content: "min-w-0 flex-1 space-y-0.5 pt-1",
          // Coloured strip down the left edge, per type (literal classes so Tailwind generates them).
          default: "before:bg-border",
          description: "text-muted-foreground! text-[13px] leading-5",
          error: "before:bg-destructive",
          icon: "m-0! h-8! w-8! shrink-0",
          info: "before:bg-primary",
          loading: "before:bg-primary",
          success: "before:bg-success",
          title: "text-sm font-semibold leading-5",
          toast:
            "group/toast bg-popover text-popover-foreground relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-3.5 pr-11 shadow-xl before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
          warning: "before:bg-warning",
        },
        unstyled: true,
      }}
    />
  );
}
