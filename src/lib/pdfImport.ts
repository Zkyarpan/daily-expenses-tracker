/**
 * src/lib/pdfImport.ts — server-only helpers for PDF statement import.
 *
 * Which reader is available is decided on the server, where the API keys
 * live; the browser never sees the keys, only the resulting mode.
 */

import { checkApiKey } from "@/lib/insights/pollinations";

/**
 * - "gemini": Google Gemini reads the PDF directly (also handles scanned PDFs).
 * - "ai":     text is extracted locally, then Pollinations finds the transactions.
 * - "basic":  text is extracted locally and read with built-in rules (no AI).
 */
export type PdfImportMode = "ai" | "basic" | "gemini";

export function getPdfImportMode(): PdfImportMode {
  if (process.env.GOOGLE_GEMINI_API_KEY?.trim()) return "gemini";
  if (checkApiKey(process.env.POLLINATIONS_API_KEY) === null) return "ai";
  return "basic";
}

/** Extracts the selectable text of a PDF. Empty for scanned (image-only) PDFs. */
export async function extractPdfText(data: Uint8Array): Promise<string> {
  // Loaded on demand so pages that only need the mode don't load the PDF library.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}
