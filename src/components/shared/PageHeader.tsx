import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Right-aligned controls (primary action last). Wraps below on mobile. */
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  /** Small context line above the title, e.g. a period or a status badge. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
}

/**
 * The single page-title pattern used by every protected page, so headings,
 * spacing and action placement are identical across the app.
 */
export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem] sm:leading-9">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground max-w-2xl text-sm leading-6">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
