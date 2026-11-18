"use client";

import { z } from "zod";

import { Input } from "@/components/ui/input";
import { LOCALE_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

/** Amount typed as text in forms ("25", "25.5", "25.50"); converted with Number() on submit. */
export const amountText = z
  .string()
  .trim()
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter an amount like 25 or 25.50.")
  .refine((v) => Number(v) > 0, "Enter an amount above zero.");

/** Same, but empty is allowed. */
export const optionalAmountText = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,7}(\.\d{1,2})?$/.test(v), "Enter an amount like 25 or 25.50.");

/** Number → form text ("25", "25.5"). */
export const toAmountText = (value: number | null | undefined) => (value ? String(Math.round(value * 100) / 100) : "");

/** Text input with the currency symbol inside it. */
export function MoneyInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        {LOCALE_CONFIG.symbol}
      </span>
      <Input inputMode="decimal" autoComplete="off" placeholder="0.00" className={cn("pl-7 tabular-nums", className)} {...props} />
    </div>
  );
}

/** Small "£25" style buttons that fill an amount field. */
export function QuickAmounts({
  amounts,
  onPick,
}: {
  amounts: { label: string; value: number }[];
  onPick: (value: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {amounts.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => onPick(a.value)}
          className="bg-muted hover:bg-muted/70 focus-visible:ring-ring rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
