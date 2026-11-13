import { cn, formatCurrency, formatCurrencyCompact } from "@/lib/utils";

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

/** Formatted currency (GBP, en-GB) with tabular figures. */
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
  const formatted = compact
    ? formatCurrencyCompact(amount, options)
    : formatCurrency(amount, options);

  return (
    <span className={cn("tabular-nums", TONE_CLASS[tone], className)} {...props}>
      {formatted}
    </span>
  );
}
