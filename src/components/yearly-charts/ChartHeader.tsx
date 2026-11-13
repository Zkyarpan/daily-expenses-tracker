import { cn } from "@/lib/utils";

interface ChartHeaderProps {
  /** Controls on the right, e.g. a chart-type toggle. */
  action?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
}

/** One heading pattern for every chart card on the Yearly Charts page. */
export function ChartHeader({ action, className, description, title }: ChartHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs leading-5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Centred placeholder used inside a chart card when there is nothing to plot. */
export function ChartEmpty({ message = "No data for the current filters" }: { message?: string }) {
  return (
    <div className="text-muted-foreground flex h-[260px] items-center justify-center rounded-xl border border-dashed text-sm">
      {message}
    </div>
  );
}
