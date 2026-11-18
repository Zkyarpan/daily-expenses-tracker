"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_CURRENCY } from "@/lib/currency";
import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * The server always renders GBP. While the page hydrates, amounts are shown
 * the same way, then switch to the currency chosen on this device — so a
 * non-GBP choice never causes a hydration mismatch.
 */
function serverFormat(amount: number, compact: boolean, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat("en-GB", {
    currency: DEFAULT_CURRENCY,
    currencyDisplay: "narrowSymbol",
    style: "currency",
    ...(compact ? { maximumFractionDigits: 1, minimumFractionDigits: 0, notation: "compact" as const } : {}),
    ...options,
  }).format(amount);
}

export type MoneyTone = "default" | "muted" | "negative" | "positive";

const TONE_CLASS: Record<MoneyTone, string> = {
  default: "",
  muted: "text-muted-foreground",
  negative: "text-destructive",
  positive: "text-success",
};

interface MoneyProps extends Omit<React.ComponentProps<"span">, "children"> {
  amount: number;
  /** Compact notation, e.g. £13.5K — for chart axes and dense tiles. */
  compact?: boolean;
  /** Show "+" on positive values (deltas, refunds). */
  signed?: boolean;
  /** Colour is the caller's decision: an expense is not automatically "bad". */
  tone?: MoneyTone;
}

/** Formatted currency (the chosen currency, en-GB style) with tabular figures. */
export function Money({
  amount,
  className,
  compact = false,
  signed = false,
  tone = "default",
  ...props
}: MoneyProps) {
  const options: Intl.NumberFormatOptions | undefined = signed
    ? { signDisplay: "exceptZero" }
    : undefined;
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const formatted = !hydrated
    ? serverFormat(amount, compact, options)
    : compact
      ? formatCurrencyCompact(amount, options)
      : formatCurrency(amount, options);

  return (
    <span className={cn("tabular-nums", TONE_CLASS[tone], className)} {...props}>
      {formatted}
    </span>
  );
}
