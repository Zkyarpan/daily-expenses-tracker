"use client";

import { Check, Info, Loader2, TriangleAlert, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

import { cn } from "@/lib/utils";

/**
 * App-wide notification pop-ups (Sonner), mounted once in the root layout so
 * every page — sign-in and sign-up included — uses the same design: a solid
 * card with a round coloured icon, a bold title, an optional one-line
 * description and action, and a close button.
 *
 * Use it with Sonner's API anywhere: `toast.success("Saved", { description })`,
 * `toast.error(…)`, `toast.warning(…)`, `toast.info(…)`, `toast.loading(…)`.
 *
 * Several at once: up to 3 show as a readable list (newest on top), the rest
 * queue until one closes. Give related toasts the same `id` so a newer one
 * replaces the old instead of piling up. Toasts pause on hover and are
 * announced to screen readers.
 */

function Dot({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={cn("flex size-6 items-center justify-center rounded-full [&_svg]:size-3.5 [&_svg]:stroke-[2.75]", className)}>
      {children}
    </span>
  );
}

const ICONS = {
  close: <X className="size-3.5" aria-hidden />,
  error: (
    <Dot className="bg-destructive text-white">
      <X aria-hidden />
    </Dot>
  ),
  info: (
    <Dot className="bg-primary text-primary-foreground">
      <Info aria-hidden />
    </Dot>
  ),
  loading: (
    <Dot className="bg-primary/15 text-primary">
      <Loader2 className="animate-spin" aria-hidden />
    </Dot>
  ),
  success: (
    <Dot className="bg-success text-white">
      <Check aria-hidden />
    </Dot>
  ),
  warning: (
    <Dot className="bg-warning text-white dark:text-black">
      <TriangleAlert aria-hidden />
    </Dot>
  ),
};

export function AppToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      // Just below the 64 px top bar (always visible); full width on phones.
      offset={{ right: 20, top: 76 }}
      mobileOffset={{ left: 12, right: 12, top: 72 }}
      // Show several toasts as a list rather than a pile, so each is readable.
      expand
      gap={10}
      visibleToasts={3}
      duration={5000}
      closeButton
      icons={ICONS}
      // Sonner sizes its container from --width; toasts fill it.
      style={{ "--width": "360px" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          // Buttons wrap onto their own row, lined up under the text.
          actionButton:
            "bg-primary! text-primary-foreground! hover:bg-primary/90! mt-2.5! ml-9! h-7! rounded-full! px-3! text-xs! font-semibold! transition-colors",
          cancelButton: "bg-muted! text-foreground! hover:bg-muted/70! mt-2.5! ml-9! h-7! rounded-full! px-3! text-xs! font-medium!",
          closeButton:
            "absolute! top-2! right-2! left-auto! size-6! transform-none! rounded-full! border-0! bg-transparent! text-muted-foreground! hover:bg-muted! hover:text-foreground! flex! items-center! justify-center!",
          // Fills the row beside the 24 px icon (icon + gap = 2.25rem).
          content: "min-w-0 grow basis-[calc(100%-2.25rem)]",
          description: "text-muted-foreground! mt-0.5 text-[13px] leading-[1.35rem]",
          // A faint wash of the type's colour so each kind is recognisable at a glance.
          error: "[--toast-tint:var(--destructive)]",
          icon: "m-0! flex h-6! w-6! shrink-0 items-center justify-center",
          info: "[--toast-tint:var(--primary)]",
          loading: "[--toast-tint:var(--primary)]",
          success: "[--toast-tint:var(--success)]",
          title: "pr-5 text-sm leading-6 font-semibold",
          toast: cn(
            "text-popover-foreground flex w-full flex-wrap items-start gap-x-3 rounded-xl border py-3 pr-3 pl-3.5 font-sans shadow-lg",
            "[&_[data-cancel]+[data-action]]:ml-2!",
            "bg-[color-mix(in_oklch,var(--toast-tint,var(--popover))_7%,var(--popover))]",
            "border-[color-mix(in_oklch,var(--toast-tint,var(--border))_30%,var(--border))]",
          ),
          warning: "[--toast-tint:var(--warning)]",
        },
        unstyled: true,
      }}
    />
  );
}
