import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface StatCardDelta {
  /** Which direction is good news. For spending, "down" is good. */
  goodDirection: "down" | "up";
  /** Comparison context shown after the change, e.g. "vs last month". */
  label?: string;
  /** Percentage change (12.5 = +12.5 %). `null` when there is no comparison base. */
  value: number | null;
}

interface StatCardProps {
  /** Extra content under the value, e.g. a <Meter />. */
  children?: React.ReactNode;
  className?: string;
  delta?: StatCardDelta;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  /** Usually plain text; may include an inline info tooltip trigger. */
  label: React.ReactNode;
  value: React.ReactNode;
}

/** Tinted change chip: arrow + sign + colour, so it never relies on colour alone. */
export function Delta({ delta }: { delta: StatCardDelta }) {
  if (delta.value === null || !Number.isFinite(delta.value)) {
    return <span>No earlier data to compare</span>;
  }

  const rounded = Math.round(delta.value * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const isGood = direction === "flat" ? null : direction === delta.goodDirection;
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
        isGood === null && "bg-muted text-muted-foreground",
        isGood === true && "bg-success/10 text-success",
        isGood === false && "bg-destructive/10 text-destructive",
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {sign}
      {Math.abs(rounded).toFixed(1)}%
    </span>
  );
}

/**
 * Summary metric tile. Change is shown with an arrow, a sign and a colour, so
 * it never relies on colour alone.
 */
export function StatCard({
  children,
  className,
  delta,
  hint,
  icon: Icon,
  label,
  value,
}: StatCardProps) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <div className="flex h-full flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="text-muted-foreground min-w-0 text-[13px] leading-5 font-medium sm:text-sm">{label}</div>
          {/* Decorative: hidden in two-up phone grids so the label has room. */}
          {Icon && (
            <span className="bg-muted text-muted-foreground -mt-0.5 hidden size-8 shrink-0 items-center justify-center rounded-lg min-[26rem]:flex">
              <Icon aria-hidden className="size-4" />
            </span>
          )}
        </div>
        <div className="truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
          {value}
        </div>
        {(delta || hint) && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            {delta && <Delta delta={delta} />}
            {delta?.label && <span>{delta.label}</span>}
            {hint && <span>{hint}</span>}
          </div>
        )}
        {children}
      </div>
    </Card>
  );
}

export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden className={cn("gap-0 py-0", className)}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="hidden size-8 rounded-lg min-[26rem]:block" />
        </div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-40 max-w-full" />
      </div>
    </Card>
  );
}
