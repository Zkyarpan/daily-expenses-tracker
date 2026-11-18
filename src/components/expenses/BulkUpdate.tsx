"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { DatePicker } from "@/components/shared/DatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseWithDetails } from "@/entities/Expense";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_TAGS,
  LOCALE_CONFIG,
} from "@/lib/config";

interface BulkUpdateProps {
  selectedCount: number;
  onApplyBulkUpdate: (
    field: keyof ExpenseWithDetails,
    value: ExpenseWithDetails[keyof ExpenseWithDetails],
  ) => void;
  /** Extra actions shown at the end of the bar (e.g. delete, clear). */
  children?: React.ReactNode;
}

// Define which fields can be bulk updated and their input types
type BulkUpdateField =
  | "amount"
  | "categoryId"
  | "tagId"
  | "memberId"
  | "date"
  | "description";

// Configuration for bulk update fields
const BULK_UPDATE_FIELDS: Array<{
  value: BulkUpdateField;
  label: string;
  type: "number" | "select" | "date" | "text";
}> = [
  { label: "Transaction Date", type: "date", value: "date" },
  { label: "Amount", type: "number", value: "amount" },
  { label: "Category", type: "select", value: "categoryId" },
  { label: "Location", type: "select", value: "tagId" },
  { label: "Paid by", type: "select", value: "memberId" },
  { label: "Description", type: "text", value: "description" },
];

export const BulkUpdate = ({
  selectedCount,
  onApplyBulkUpdate,
  children,
}: BulkUpdateProps) => {
  const [selectedField, setSelectedField] = useState<BulkUpdateField | "">("");
  const [fieldValue, setFieldValue] = useState<string>("");

  const handleApply = () => {
    if (!selectedField || !fieldValue) return;

    let processedValue: ExpenseWithDetails[keyof ExpenseWithDetails];

    // Convert value based on field type
    const fieldConfig = BULK_UPDATE_FIELDS.find(
      (f) => f.value === selectedField,
    );

    if (fieldConfig?.type === "number") {
      processedValue = parseFloat(fieldValue);
      if (isNaN(processedValue as number)) return;
    } else if (fieldConfig?.type === "date") {
      processedValue = new Date(fieldValue);
    } else if (fieldConfig?.type === "text") {
      processedValue = fieldValue;
    } else {
      processedValue = fieldValue === "none" ? null : fieldValue;
    }

    onApplyBulkUpdate(selectedField, processedValue);

    // Reset after applying
    setFieldValue("");
  };

  const renderValueInput = () => {
    if (!selectedField) return null;

    const fieldConfig = BULK_UPDATE_FIELDS.find(
      (f) => f.value === selectedField,
    );

    switch (fieldConfig?.type) {
      case "number":
        return (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="text-muted-foreground text-sm">
              {LOCALE_CONFIG.symbol}
            </span>
            <Input
              type="number"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder="Enter amount..."
              className="h-9 w-full sm:w-32"
              step="0.01"
              min="0"
            />
          </div>
        );

      case "date":
        return (
          <DatePicker
            aria-label="New date"
            value={fieldValue}
            onChange={setFieldValue}
            className="h-9 w-full border sm:w-44"
          />
        );

      case "text":
        return (
          <Input
            type="text"
            value={fieldValue}
            onChange={(e) => setFieldValue(e.target.value)}
            placeholder="Add description..."
            className="h-9 w-full sm:w-64"
          />
        );

      case "select":
        let options: Array<{ id: string; name: string }> = [];

        if (selectedField === "categoryId") {
          options = DEFAULT_CATEGORIES;
        } else if (selectedField === "tagId") {
          options = DEFAULT_TAGS;
        } else if (selectedField === "memberId") {
          options = DEFAULT_MEMBERS;
        }

        return (
          <Select value={fieldValue} onValueChange={setFieldValue}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="Select value..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      default:
        return null;
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Selected expenses"
      // Phones: sticks under the top bar while you scroll the list, so the
      // actions stay in reach. Count + delete/clear on top, the editor below.
      className="bg-popover sticky top-16 z-30 flex flex-wrap items-center gap-2 rounded-2xl border p-2 pl-4 shadow-lg md:static md:shadow-md dark:border-white/15"
    >
      <div className="text-sm font-semibold tabular-nums">
        {selectedCount} selected
      </div>

      {children && <div className="ml-auto flex items-center gap-1 md:order-last">{children}</div>}

      <div className="bg-border mx-1 hidden h-5 w-px md:block" aria-hidden />

      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:flex-1">
      <Select
        value={selectedField}
        onValueChange={(value) => {
          setSelectedField(value as BulkUpdateField);
          setFieldValue("");
        }}
      >
        <SelectTrigger className="h-9 w-full sm:w-48">
          <SelectValue placeholder="Change a field…" />
        </SelectTrigger>
        <SelectContent>
          {BULK_UPDATE_FIELDS.map((field) => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedField && (
        <>
          <div className="min-w-0 flex-1 sm:flex-none">{renderValueInput()}</div>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={!fieldValue}
            className="h-9 gap-1.5"
          >
            <Check className="size-3.5" />
            Apply
          </Button>
        </>
      )}
      </div>
    </div>
  );
};
