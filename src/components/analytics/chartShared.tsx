"use client";

import type { ReactNode } from "react";

import type { ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

/**
 * Tooltip row formatter for currency series: colour swatch, series label and
 * GBP value. Recharts tooltips are mirrored into an accessible layer by
 * `accessibilityLayer`, so keyboard users can step through data points.
 */
export const moneyTooltipFormatter = (config: ChartConfig) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MoneyTooltipRow(value: unknown, name: unknown, item: any): ReactNode {
    const key = String(name);
    const color = item?.color || item?.payload?.fill || "currentColor";
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

/** Shared empty / unavailable state used inside chart cards. */
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
  <div className="flex h-[280px] flex-col items-center justify-center px-6 text-center">
    <div className="bg-muted text-muted-foreground mb-3 flex size-11 items-center justify-center rounded-xl" aria-hidden>
      {icon}
    </div>
    <p className="text-sm font-medium">{title}</p>
    <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-5">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
