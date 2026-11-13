import { PageHeader } from "@/components/shared/PageHeader";
import { getPdfImportMode } from "@/lib/pdfImport";

import CSVImportWizard from "./CSVImportWizard";

export default function ImportPage() {
  // Decided on the server, where the API keys are; only the mode is sent down.
  const pdfMode = getPdfImportMode();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Expenses"
        description="Bring in a CSV export or a PDF bank statement, check every row, then save them in one go."
      />
      <CSVImportWizard pdfMode={pdfMode} />
    </div>
  );
}
