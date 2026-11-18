"use client";

import { memo, useId, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import MonthYearSelector from "@/components/expenses/MonthYearSelector";
import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CategoryFilter from "@/components/yearly-charts/CategoryFilter";
import YearSelector from "@/components/YearSelector";
import { categoryNameOf } from "@/hooks/analytics/useAnalytics";
import {
  MAX_CUSTOM_RANGE_MONTHS,
  type PeriodSelection,
  resolvePeriod,
  toDateKey,
  UNCATEGORIZED_KEY,
  validateCustomRange,
} from "@/lib/analytics";
import { DEFAULT_CATEGORIES } from "@/lib/config";

/** Every category the user can filter by, in display order. */
const CATEGORY_KEYS = [...DEFAULT_CATEGORIES.map((c) => c.id), UNCATEGORIZED_KEY];
const CATEGORY_NAMES = CATEGORY_KEYS.map(categoryNameOf);
const KEY_BY_NAME = new Map(CATEGORY_KEYS.map((k) => [categoryNameOf(k), k]));

type AnalyticsFiltersProps = {
  selection: PeriodSelection;
  onSelectionChange: (selection: PeriodSelection) => void;
  /** Selected category keys; empty = all categories. */
  categoryKeys: readonly string[];
  onCategoryKeysChange: (keys: string[]) => void;
  isDefault: boolean;
  onReset: () => void;
};

const switchKind = (from: PeriodSelection, kind: PeriodSelection["kind"]): PeriodSelection => {
  const range = resolvePeriod(from);
  const now = new Date();
  const year = range.end.getFullYear();
  if (kind === "year") return { kind, year };
  if (kind === "month") {
    return { kind, month: year === now.getFullYear() ? now.getMonth() : range.end.getMonth(), year };
  }
  return { end: toDateKey(range.end), kind, start: toDateKey(range.start) };
};

/** Start/end inputs that only publish a range once it is valid. */
const CustomRangeInputs = ({
  end,
  onChange,
  start,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) => {
  const id = useId();
  // Mounted only while "Custom range" is active, so props seed the draft once;
  // later changes to start/end originate from these inputs themselves.
  const [draft, setDraft] = useState({ end, start });

  const error = validateCustomRange(draft.start, draft.end);

  const update = (next: { start: string; end: string }) => {
    setDraft(next);
    if (!validateCustomRange(next.start, next.end)) onChange(next.start, next.end);
  };

  const describedBy = error ? `${id}-error` : `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Phones: "From / to" labels in a column beside full-width date fields. */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
        <Label htmlFor={`${id}-start`} className="text-muted-foreground text-xs font-normal">
          From
        </Label>
        <DatePicker
          id={`${id}-start`}
          className="h-9 w-full border sm:w-40"
          value={draft.start}
          max={draft.end || undefined}
          presets={false}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(start) => update({ ...draft, start })}
        />
        <Label htmlFor={`${id}-end`} className="text-muted-foreground text-xs font-normal">
          to
        </Label>
        <DatePicker
          id={`${id}-end`}
          className="h-9 w-full border sm:w-40"
          value={draft.end}
          min={draft.start || undefined}
          presets={false}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          onChange={(end) => update({ ...draft, end })}
        />
        {!error && (
          <span id={`${id}-hint`} className="text-muted-foreground col-span-2 text-xs">
            Max {MAX_CUSTOM_RANGE_MONTHS} months
          </span>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
};

const AnalyticsFilters = ({
  categoryKeys,
  isDefault,
  onCategoryKeysChange,
  onReset,
  onSelectionChange,
  selection,
}: AnalyticsFiltersProps) => {
  // CategoryFilter works with names and treats "all selected" as the default.
  const selectedNames = useMemo(
    () => (categoryKeys.length > 0 ? categoryKeys.map(categoryNameOf) : CATEGORY_NAMES),
    [categoryKeys],
  );

  const handleCategoryChange = (names: string[]) => {
    const keys = names.map((n) => KEY_BY_NAME.get(n)).filter((k): k is string => !!k);
    // Selecting everything (or nothing) means "all categories".
    onCategoryKeysChange(keys.length === CATEGORY_KEYS.length ? [] : keys);
  };

  return (
    <section
      aria-label="Analytics filters"
      className="bg-card flex flex-col gap-3 rounded-2xl p-3 shadow-sm sm:px-4 lg:flex-row lg:items-center lg:justify-between print:hidden"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Tabs
          value={selection.kind}
          onValueChange={(v) => onSelectionChange(switchKind(selection, v as PeriodSelection["kind"]))}
        >
          <TabsList aria-label="Period type" className="w-full group-data-[orientation=horizontal]/tabs:h-9 sm:w-fit sm:group-data-[orientation=horizontal]/tabs:h-8">
            <TabsTrigger value="month" className="px-3 text-xs">Month</TabsTrigger>
            <TabsTrigger value="year" className="px-3 text-xs">Year</TabsTrigger>
            <TabsTrigger value="custom" className="px-3 text-xs">Custom</TabsTrigger>
          </TabsList>
        </Tabs>

        <span className="bg-border hidden h-5 w-px sm:block" aria-hidden />

        {selection.kind === "month" && (
          <MonthYearSelector
            currentMonth={selection.month}
            currentYear={selection.year}
            onMonthYearChange={(month, year) => onSelectionChange({ kind: "month", month, year })}
          />
        )}
        {selection.kind === "year" && (
          <YearSelector
            value={selection.year}
            onValueChange={(year) => onSelectionChange({ kind: "year", year })}
            range={10}
            triggerClassName="h-8 w-24"
          />
        )}
        {selection.kind === "custom" && (
          <CustomRangeInputs
            start={selection.start}
            end={selection.end}
            onChange={(start, end) => onSelectionChange({ end, kind: "custom", start })}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isDefault && (
          <Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={onReset}>
            <RotateCcw className="size-3.5" aria-hidden />
            Reset
          </Button>
        )}
        <CategoryFilter
          categories={CATEGORY_NAMES}
          selectedCategories={selectedNames}
          onSelectionChange={handleCategoryChange}
        />
      </div>
    </section>
  );
};

export default memo(AnalyticsFilters);
