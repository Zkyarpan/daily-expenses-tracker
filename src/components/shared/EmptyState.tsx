import { Inbox, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  /** Buttons/links that resolve the empty state (primary first). */
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** Heading element; keep the document outline correct for where it is used. */
  headingLevel?: "h2" | "h3";
  icon?: LucideIcon;
  title: string;
  /** "card" draws its own dashed container; "plain" sits inside an existing card or table. */
  variant?: "card" | "plain";
}

/** Centred icon + heading + guidance + next action. */
export function EmptyState({
  actions,
  className,
  description,
  headingLevel: Heading = "h3",
  icon: Icon = Inbox,
  title,
  variant = "card",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "card" ? "bg-card/60 rounded-xl border border-dashed py-14" : "py-10",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground ring-border mb-4 flex size-12 items-center justify-center rounded-xl ring-1">
        <Icon aria-hidden className="size-5" />
      </div>
      <Heading className="text-base font-semibold tracking-tight">{title}</Heading>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-md text-sm leading-6">
          {description}
        </p>
      )}
      {actions && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
