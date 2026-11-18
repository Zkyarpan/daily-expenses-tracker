"use client";

import type { ReactNode } from "react";

import type { ChartConfig } from "@/components/ui/chart";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * Card shell for every chart and report on the analytics page. Same surface,
 * radius, padding and heading scale as the Dashboard panels.
 */
export const AnalyticsPanel = ({
  action,
  children,
  className,
  description,
  title,
}: {
  title: string;
  description?: ReactNode;
  /** Right-aligned header content, e.g. a change chip or a link. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl p-5 shadow-md sm:p-6",
      className,
    )}
  >
    <div className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && (
          <div className="text-muted-foreground mt-0.5 text-xs leading-5">{description}</div>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
    {children}
  </section>
);

/** Static chart legend, for charts whose bar colours do not map 1:1 to series. */
export const LegendSwatches = ({
  items,
}: {
  items: { color: string; label: string }[];
}) => (
  <ul className="text-muted-foreground mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
    {items.map((item) => (
      <li key={item.label} className="flex items-center gap-1.5">
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: item.color }} aria-hidden />
        {item.label}
      </li>
    ))}
  </ul>
);

/** Muted fill for "reference" series (budgets, last year) so the actual data stands out. */
export const REFERENCE_FILL = "color-mix(in oklch, var(--muted-foreground) 30%, transparent)";

/**
 * Tooltip row formatter for currency series: colour swatch, series label and
 * GBP value. Recharts tooltips are mirrored into an accessible layer by
 * `accessibilityLayer`, so keyboard users can step through data points.
 */
export const moneyTooltipFormatter = (
  config: ChartConfig,
  /** Overrides the swatch colour, e.g. for bars coloured per data point. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  colorFor?: (key: string, payload: any) => string | undefined,
) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MoneyTooltipRow(value: unknown, name: unknown, item: any): ReactNode {
    const key = String(name);
    const color = colorFor?.(key, item?.payload) || item?.color || item?.payload?.fill || "currentColor";
    return (
      <div className="flex w-full items-center justify-between gap-4">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} aria-hidden />
          {config[key]?.label ?? key}
        </span>
        <span className="text-foreground font-mono font-medium tabular-nums">
          {formatCurrency(Number(value))}
        </span>
      </div>
    );
  };

/** Shared empty / unavailable state used inside chart panels. */
export const ChartEmptyState = ({
  action,
  description,
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) => (
  <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center">
    <div className="bg-muted text-muted-foreground ring-border mb-3 flex size-11 items-center justify-center rounded-xl ring-1" aria-hidden>
      {icon}
    </div>
    <p className="text-sm font-medium">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
