"use client";

import { useState } from "react";
import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** "YYYY-MM-DD" ⇄ local Date, without time-zone shifts. */
const pad = (n: number) => String(n).padStart(2, "0");
export const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key: string | null | undefined): Date | undefined => {
  if (!key) return undefined;
  const [y, m, d] = key.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};

type TriggerProps = Omit<React.ComponentProps<"button">, "onChange" | "value" | "children">;

export interface DatePickerProps extends TriggerProps {
  /** Shows a "Clear" button (for optional dates). */
  clearable?: boolean;
  /** Latest/earliest allowed day, "YYYY-MM-DD". */
  max?: string;
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Quick picks above the calendar. Defaults to Today + Yesterday. */
  presets?: { label: string; value: string }[] | false;
  /** "ghost" blends into a table cell until hovered. */
  variant?: "default" | "ghost";
  /** "YYYY-MM-DD", or "" for no date. */
  value: string | null | undefined;
}

/**
 * Calendar date picker used everywhere instead of the browser's own date
 * field: the same look on every device, month/year dropdowns for jumping far,
 * and one-tap "Today" / "Yesterday". Works with React Hook Form's
 * <FormControl> (id/aria props go on the button).
 */
export function DatePicker({
  className,
  clearable = false,
  disabled,
  max,
  min,
  onChange,
  placeholder = "Pick a date",
  presets,
  value,
  variant = "default",
  ...props
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromKey(value);
  const minDate = fromKey(min);
  const maxDate = fromKey(max);

  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const quick =
    presets === false
      ? []
      : (presets ?? [
          { label: "Today", value: toDateKey(today) },
          { label: "Yesterday", value: toDateKey(yesterday) },
        ]).filter((p) => (!min || p.value >= min) && (!max || p.value <= max));

  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };

  const label = selected
    ? selected.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        weekday: variant === "ghost" ? undefined : "short",
        year: "numeric",
      })
    : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          {...props}
          className={cn(
            "w-full justify-start gap-2 rounded-xl px-3 text-left font-normal",
            variant === "default" && "h-10 border-2",
            variant === "ghost" &&
              "hover:border-input hover:bg-muted/40 h-8 border border-transparent bg-transparent px-2 shadow-none dark:bg-transparent",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className="text-muted-foreground size-4 shrink-0" aria-hidden />
          <span className="truncate tabular-nums">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {(quick.length > 0 || (clearable && selected)) && (
          <div className="flex flex-wrap items-center gap-1.5 border-b p-2">
            {quick.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={value === p.value ? "default" : "secondary"}
                className="h-8 rounded-lg px-3"
                onClick={() => pick(p.value)}
              >
                {p.label}
              </Button>
            ))}
            {clearable && selected && (
              <Button type="button" size="sm" variant="ghost" className="text-muted-foreground ml-auto h-8 gap-1 px-2" onClick={() => pick("")}>
                <X className="size-3.5" aria-hidden />
                Clear
              </Button>
            )}
          </div>
        )}
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected ?? maxDate ?? today}
          captionLayout="dropdown"
          startMonth={minDate ?? new Date(today.getFullYear() - 10, 0)}
          endMonth={maxDate ?? new Date(today.getFullYear() + 10, 11)}
          disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          onSelect={(day) => day && pick(toDateKey(day))}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
