"use client";

import React from "react";
import {
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { createColumns } from "@/app/(protected)/expenses/columns";
import { DataTable } from "@/app/(protected)/expenses/data-table";
import { StandardFormatMapping } from "@/components/import-expenses/StandardFormatMapping";
import { StandardWithCategoryMapping } from "@/components/import-expenses/StandardWithCategoryMapping";
import { WideFormatMappingComponent } from "@/components/import-expenses/WideFormatMapping";
import {
  CSVImportProvider,
  DocumentStyle,
  Step,
  useCSVImport,
} from "@/components/providers/context/CSVImportContext";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MEMBERS,
  DEFAULT_TAGS,
} from "@/lib/config";
import type { PdfImportMode } from "@/lib/pdfImport";
import { getIsDemoMode } from "@/lib/supabase";
import { cn, formatCurrency } from "@/lib/utils";

const WIZARD_STEPS: { id: Step; label: string; hint: string }[] = [
  { hint: "Choose a file", id: "upload", label: "Upload" },
  { hint: "Match the columns", id: "map", label: "Map columns" },
  { hint: "Check and save", id: "preview", label: "Review" },
];

const DOCUMENT_STYLE_HINTS: Record<DocumentStyle, string> = {
  standard: "Date, amount and description are separate columns.",
  "standard-with-category": "Like standard, plus a category column.",
  "wide-format": "Each category is its own column of amounts.",
};

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  return (
    <nav aria-label="Import progress">
      <ol className="flex items-center gap-2 sm:gap-3">
        {WIZARD_STEPS.map((s, i) => {
          const isDone = i < currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li
              key={s.id}
              className={cn("flex items-center gap-2 sm:gap-3", i < WIZARD_STEPS.length - 1 && "flex-1")}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
                  isCurrent && "bg-primary text-primary-foreground",
                  isDone && "bg-primary/15 text-foreground",
                  !isCurrent && !isDone && "bg-muted text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              {/* On narrow screens only the current step keeps its label. */}
              <span className={cn("min-w-0", !isCurrent && "sr-only sm:not-sr-only")}>
                <span
                  className={cn(
                    "block text-sm leading-tight font-medium whitespace-nowrap",
                    !isCurrent && "text-muted-foreground",
                  )}
                >
                  {s.label}
                  {isDone && <span className="sr-only"> (done)</span>}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:block">{s.hint}</span>
              </span>
              {i < WIZARD_STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={cn("h-px min-w-4 flex-1", isDone ? "bg-primary/40" : "bg-border")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Click-or-drop file target. The real <input type="file"> stays in the tab order. */
function FileDropZone({
  accept,
  disabled,
  disabledHint,
  hint,
  id,
  label,
  onFile,
}: {
  accept: string;
  disabled?: boolean;
  disabledHint?: string;
  hint: string;
  id: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const [isOver, setIsOver] = React.useState(false);

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        if (disabled) return;
        const file = e.dataTransfer.files?.[0];
        if (file) onFile(file);
      }}
      className={cn(
        "group/drop flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors",
        "has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px]",
        disabled
          ? "bg-muted/20 cursor-not-allowed opacity-60"
          : "bg-muted/30 hover:bg-muted/60 hover:border-foreground/25 cursor-pointer",
        isOver && "border-foreground/40 bg-muted/70",
      )}
    >
      <span className="bg-background text-muted-foreground ring-border flex size-10 items-center justify-center rounded-xl ring-1">
        <Upload className="size-4" aria-hidden />
      </span>
      <span className="text-sm font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{disabled && disabledHint ? disabledHint : hint}</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
}

const PDF_MODE_COPY: Record<PdfImportMode, { badge: string; description: string; privacy: string }> = {
  ai: {
    badge: "AI",
    description: "We read the text of your statement and AI picks out each transaction.",
    privacy: "The statement's text is sent to the AI service (Pollinations) to find transactions. The file itself isn't stored.",
  },
  basic: {
    badge: "Built-in reader",
    description: "We read the text of your statement and pick out lines with a date and an amount.",
    privacy: "Your statement is read on this server only. Add an AI key for smarter matching of merchants and categories.",
  },
  gemini: {
    badge: "AI",
    description: "Google Gemini reads your statement, including scanned PDFs, and picks out each transaction.",
    privacy: "The PDF is sent to Google Gemini to find transactions. The file itself isn't stored.",
  },
};

// Step 1: Upload Component
function UploadStep({ pdfMode }: { pdfMode: PdfImportMode }) {
  const { documentStyle, setDocumentStyle, handleFile, setStep, setMappedData } =
    useCSVImport();
  const [isProcessingPDF, setIsProcessingPDF] = React.useState(false);
  const pdfCopy = PDF_MODE_COPY[pdfMode];

  const processPdf = async (file: File) => {
    setIsProcessingPDF(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-pdf", {
        body: formData,
        method: "POST",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 429 || payload.code === "RATE_LIMIT") {
          toast.error("The AI service is busy", {
            description: payload.error || "Please wait a minute and try again.",
          });
          return;
        }
        toast.error("Couldn't read that PDF", {
          description: payload.error || "Please try again, or import a CSV instead.",
        });
        return;
      }

      const expenses = payload.expenses ?? [];
      const found = `Found ${expenses.length} ${expenses.length === 1 ? "transaction" : "transactions"}`;
      if (payload.source === "rules") {
        toast.success(found, {
          description: payload.notice || "Read with the built-in reader — check each row before saving.",
        });
      } else {
        toast.success(found, { description: "Check each row before saving." });
      }
      setMappedData(expenses);
      setStep("preview");
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast.error("Couldn't read that PDF", {
        description: "Check your connection and try again.",
      });
    } finally {
      setIsProcessingPDF(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* CSV */}
      <Card className="gap-0 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <FileSpreadsheet className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">CSV file</h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Export from your bank or a spreadsheet, then match the columns.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="document-style">1. File layout</Label>
          <Select
            value={documentStyle || ""}
            onValueChange={(val) => setDocumentStyle(val as DocumentStyle)}
          >
            <SelectTrigger id="document-style" className="w-full">
              <SelectValue placeholder="Choose how your file is laid out" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Standard (bank statement)</SelectItem>
              <SelectItem value="standard-with-category">Standard with category</SelectItem>
              <SelectItem value="wide-format">Wide (one column per category)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            {documentStyle
              ? DOCUMENT_STYLE_HINTS[documentStyle]
              : "Pick the layout that matches your file."}
          </p>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm leading-none font-medium">2. Upload</p>
          <FileDropZone
            id="csv-upload"
            accept=".csv"
            label="Drop a CSV here or browse"
            hint="Comma-separated .csv file"
            disabled={!documentStyle}
            disabledHint="Choose a file layout first"
            onFile={handleFile}
          />
        </div>
      </Card>

      {/* PDF */}
      <Card className="gap-0 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            <FileText className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">PDF statement</h2>
              <StatusBadge>
                {pdfMode !== "basic" && <Sparkles className="size-3" aria-hidden />}
                {pdfCopy.badge}
              </StatusBadge>
            </div>
            <p className="text-muted-foreground mt-0.5 text-sm">{pdfCopy.description}</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <p className="text-sm leading-none font-medium">Upload</p>
          {isProcessingPDF ? (
            <div
              role="status"
              className="bg-muted/30 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center"
            >
              <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
              <span className="text-sm font-medium">Reading your statement…</span>
              <span className="text-muted-foreground text-xs">
                Extracting transactions from your statement.
              </span>
            </div>
          ) : (
            <FileDropZone
              id="pdf-upload"
              accept=".pdf,application/pdf"
              label="Drop a PDF here or browse"
              hint="Bank or card statement, .pdf up to 10 MB"
              onFile={processPdf}
            />
          )}
        </div>

        <p className="text-muted-foreground mt-5 text-xs leading-5">
          You can review and edit every transaction before anything is saved. {pdfCopy.privacy}
        </p>
      </Card>
    </div>
  );
}

// Step 2: Mapping Component
function MappingStep() {
  const { documentStyle } = useCSVImport();

  switch (documentStyle) {
    case "standard":
      return <StandardFormatMapping />;
    case "wide-format":
      return <WideFormatMappingComponent />;
    case "standard-with-category":
      return <StandardWithCategoryMapping />;
    default:
      return null;
  }
}

// Step 3: Preview Component
function PreviewStep() {
  const { mappedData, setStep, setMappedData, handleSave, documentStyle } = useCSVImport();
  const isDemo = getIsDemoMode();
  const total = mappedData.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Review transactions</h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Edit or remove rows before saving. Nothing is saved until you confirm.
          </p>
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">
          <span className="text-foreground font-semibold">{mappedData.length}</span>{" "}
          {mappedData.length === 1 ? "expense" : "expenses"} ·{" "}
          <span className="text-foreground font-semibold">
            {formatCurrency(total)}
          </span>
        </p>
      </div>

      <DataTable
        embedded
        data={mappedData}
        columns={createColumns({
          categories: DEFAULT_CATEGORIES,
          members: DEFAULT_MEMBERS,
          onDelete: (expense) => {
            setMappedData(mappedData.filter((item) => item.id !== expense.id));
          },
          onUpdate: (id, field, value) => {
            setMappedData(
              mappedData.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
            );
          },
          tags: DEFAULT_TAGS,
        })}
      />

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => setStep(documentStyle === null ? "upload" : "map")}
        >
          Back to {documentStyle === null ? "upload" : "mapping"}
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* span keeps the tooltip working while the button is disabled */}
            <span tabIndex={isDemo ? 0 : -1} className="inline-flex">
              <Button
                className="w-full sm:w-auto"
                onClick={handleSave}
                disabled={mappedData.length === 0 || isDemo}
              >
                Save {mappedData.length} {mappedData.length === 1 ? "expense" : "expenses"}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isDemo ? "Saving is disabled in demo mode" : "Save imported expenses to your account"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// Main component
function ImportWizard({ pdfMode }: { pdfMode: PdfImportMode }) {
  const { step } = useCSVImport();

  const renderStep = () => {
    switch (step) {
      case "upload":
        return <UploadStep pdfMode={pdfMode} />;
      case "map":
        return <MappingStep />;
      case "preview":
        return <PreviewStep />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="gap-0 px-5 py-4 sm:px-6">
        <StepIndicator step={step} />
      </Card>
      {step === "upload" ? (
        renderStep()
      ) : (
        <Card className="gap-0 p-5 sm:p-6">{renderStep()}</Card>
      )}
    </div>
  );
}

// Outer component that provides the context
export default function CSVImportWizard({ pdfMode }: { pdfMode: PdfImportMode }) {
  return (
    <CSVImportProvider>
      <ImportWizard pdfMode={pdfMode} />
    </CSVImportProvider>
  );
}
