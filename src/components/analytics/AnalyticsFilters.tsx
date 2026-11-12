"use client";

import { memo, useId, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import MonthYearSelector from "@/components/expenses/MonthYearSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-start`} className="text-muted-foreground text-xs">
            From
          </Label>
          <Input
            id={`${id}-start`}
            type="date"
            className="h-8 w-38"
            value={draft.start}
            max={draft.end || undefined}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => update({ ...draft, start: e.target.value })}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-end`} className="text-muted-foreground text-xs">
            To
          </Label>
          <Input
            id={`${id}-end`}
            type="date"
            className="h-8 w-38"
            value={draft.end}
            min={draft.start || undefined}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => update({ ...draft, end: e.target.value })}
          />
        </div>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">Up to {MAX_CUSTOM_RANGE_MONTHS} months.</p>
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
      className="bg-secondary flex flex-col gap-4 rounded-lg p-4 lg:flex-row lg:items-end lg:justify-between print:hidden"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <span className="text-muted-foreground text-xs" id="period-type-label">
            Period
          </span>
          <Tabs
            value={selection.kind}
            onValueChange={(v) => onSelectionChange(switchKind(selection, v as PeriodSelection["kind"]))}
          >
            <TabsList aria-labelledby="period-type-label" className="h-8">
              <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">Year</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs">Custom range</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

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
        <CategoryFilter
          categories={CATEGORY_NAMES}
          selectedCategories={selectedNames}
          onSelectionChange={handleCategoryChange}
        />
        {!isDefault && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onReset}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        )}
      </div>
    </section>
  );
};

export default memo(AnalyticsFilters);
