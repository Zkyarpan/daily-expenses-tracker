"use client";

import { useCSVImport } from "@/components/providers/context/CSVImportContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NONE_VALUE, STANDARD_WITH_CATEGORY_FIELDS } from "@/lib/csv-import";

export function StandardWithCategoryMapping() {
  const {
    headers,
    mapping,
    defaultMonth,
    defaultYear,
    handleStandardFieldSelect,
    setDefaultMonth,
    setDefaultYear,
    handleMappingComplete,
    setStep,
    isStandardMapping,
  } = useCSVImport();

  const isRequired = (field: string) => {
    return field === "amount";
  };

  // Early return if mapping is not standard
  if (!mapping || !isStandardMapping(mapping)) {
    return <div>Invalid mapping type</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Match columns</h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Standard format with a category column. Tell us which column holds each field.
        </p>
      </div>

      <div className="space-y-4">
        {STANDARD_WITH_CATEGORY_FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm font-medium capitalize sm:w-40">
              {field.replace(/([A-Z])/g, " $1").trim()}
              {isRequired(field) && (
                <span className="text-destructive ml-1" aria-hidden>*</span>
              )}
            </span>
            <Select
              onValueChange={(val) => handleStandardFieldSelect(field, val)}
              value={mapping[field as keyof typeof mapping] || NONE_VALUE}
            >
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {headers.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="bg-muted/40 rounded-xl p-4">
        <h3 className="text-sm font-semibold">Default date</h3>
        <p className="text-muted-foreground mt-0.5 mb-4 text-sm">
          {mapping.date
            ? "Used when date column is empty or invalid."
            : "No date column mapped. Used for all expenses."}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Label htmlFor="default-month" className="mb-2">
              Month
            </Label>
            <Select value={defaultMonth} onValueChange={setDefaultMonth}>
              <SelectTrigger id="default-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const monthNum = (i + 1).toString().padStart(2, "0");
                  const monthName = new Date(2000, i).toLocaleString(
                    "default",
                    {
                      month: "long",
                    },
                  );
                  return (
                    <SelectItem key={monthNum} value={monthNum}>
                      {monthName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Label htmlFor="default-year" className="mb-2">
              Year
            </Label>
            <Select value={defaultYear} onValueChange={setDefaultYear}>
              <SelectTrigger id="default-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => {
                  const year = (2000 + i).toString();
                  return (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Uses 1st day of month. Edit dates after import if needed.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setStep("upload")}>
          Back
        </Button>
        <Button
          onClick={handleMappingComplete}
          disabled={!mapping.amount || !mapping.description}
        >
          Continue to preview
        </Button>
      </div>
    </div>
  );
}
