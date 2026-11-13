import { RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Additional actions shown next to the retry button. */
  actions?: React.ReactNode;
  className?: string;
  message?: React.ReactNode;
  /** Shows a retry button. Must be passed from a client component. */
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  title?: string;
  /** "card" draws a tinted container; "plain" renders inline. */
  variant?: "card" | "plain";
}

/** Recoverable error message, announced to assistive technology. */
export function ErrorState({
  actions,
  className,
  message,
  onRetry,
  retryLabel = "Try again",
  retrying = false,
  title = "Something went wrong",
  variant = "card",
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start",
        variant === "card" &&
          "border-destructive/25 bg-destructive/5 rounded-xl border p-4 sm:p-5",
        className,
      )}
    >
      <div className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
        <TriangleAlert aria-hidden className="size-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {message && (
          <div className="text-muted-foreground mt-1 text-sm leading-6 break-words">
            {message}
          </div>
        )}
      </div>
      {(onRetry || actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start">
          {actions}
          {onRetry && (
            <Button disabled={retrying} onClick={onRetry} size="sm" variant="outline">
              <RotateCw aria-hidden className={cn("size-3.5", retrying && "animate-spin")} />
              {retrying ? "Retrying…" : retryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
