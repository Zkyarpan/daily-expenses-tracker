import { NextRequest, NextResponse } from "next/server";

import { Expense } from "@/entities/Expense";
import { DEFAULT_CATEGORIES, DEFAULT_TAGS, GEMINI_PDF_RULES } from "@/lib/config";
import { genAI } from "@/lib/gemini";
import { callPollinations, DEFAULT_MODEL } from "@/lib/insights/pollinations";
import { extractPdfText, getPdfImportMode } from "@/lib/pdfImport";
import {
  buildStatementMessages,
  parseAITransactions,
  parseStatementText,
  type StatementTransaction,
} from "@/lib/pdfStatement";

/**
 * POST /api/parse-pdf — reads a bank/card statement PDF into expense rows.
 *
 * 1. Gemini (if GOOGLE_GEMINI_API_KEY is set) reads the PDF itself.
 * 2. Otherwise the text is extracted locally; Pollinations (if
 *    POLLINATIONS_API_KEY is set) turns it into transactions.
 * 3. If no AI is configured or it fails, a built-in rule-based reader is used.
 *
 * Nothing is saved here: the rows go to the import preview for review.
 */

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024;

type Source = "ai" | "gemini" | "rules";

async function readWithGemini(base64: string, mimeType: string): Promise<StatementTransaction[] | null> {
  const systemInstruction = `
You are a specialized bank statement parser. Your goal is to extract every single transaction from the provided PDF.

${GEMINI_PDF_RULES}

Available categories (use the id):
${DEFAULT_CATEGORIES.map((c) => `- ${c.name} (id: ${c.id})`).join("\n")}

Available tags (use the id):
${DEFAULT_TAGS.map((t) => `- ${t.name} (id: ${t.id})`).join("\n")}

Return the data as a JSON array of objects.
Each object MUST follow this schema:
{
  "date": "YYYY-MM-DD",
  "description": "Merchant name",
  "amount": number,
  "categoryId": "string",
  "tagId": "string"
}

If you cannot find a specific category, default to categoryId "3".
Important: Return ONLY the JSON array. No markdown formatting.`;

  const model = genAI!.getGenerativeModel({
    generationConfig: { responseMimeType: "application/json" },
    model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    systemInstruction,
  });

  const result = await model.generateContent([
    { inlineData: { data: base64, mimeType } },
    "Extract all transactions from the attached bank statement.",
  ]);
  return parseAITransactions(result.response.text());
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "The PDF is larger than 10 MB." }, { status: 413 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mode = getPdfImportMode();

    let transactions: StatementTransaction[] = [];
    let source: Source = "rules";
    let notice: string | undefined;

    if (mode === "gemini" && genAI) {
      const parsed = await readWithGemini(Buffer.from(bytes).toString("base64"), "application/pdf");
      if (!parsed) {
        return NextResponse.json({ error: "The AI returned an unreadable answer. Please try again." }, { status: 502 });
      }
      transactions = parsed;
      source = "gemini";
    } else {
      const text = await extractPdfText(bytes);

      if (!text.trim()) {
        return NextResponse.json(
          {
            code: "NO_TEXT",
            error:
              "This PDF has no selectable text — it may be a scanned image. Try the statement your bank provides as a download, or export a CSV instead.",
          },
          { status: 422 },
        );
      }

      if (mode === "ai") {
        const result = await callPollinations({
          apiKey: process.env.POLLINATIONS_API_KEY,
          maxCompletionTokens: 8000,
          messages: buildStatementMessages(text),
          model: process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL,
          timeoutMs: 60_000,
        });

        if (result.ok) {
          const parsed = parseAITransactions(result.content);
          if (parsed && parsed.length > 0) {
            transactions = parsed;
            source = "ai";
          } else if (!parsed) {
            notice = "The AI answer couldn't be read, so the built-in reader was used.";
          }
        } else {
          console.warn("[parse-pdf] AI unavailable:", result.reason, result.status ?? "");
          notice = `The AI service was unavailable (${result.message.replace(/\.$/, "")}), so the built-in reader was used.`;
        }
      }

      if (source === "rules") {
        transactions = parseStatementText(text);
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        {
          code: "NO_TRANSACTIONS",
          error:
            "No spending transactions were found in this PDF. Check it is a bank or card statement, or import a CSV instead.",
        },
        { status: 422 },
      );
    }

    const now = new Date();
    const expenses: Expense[] = transactions.map((t, index) => ({
      amount: t.amount,
      categoryId: t.categoryId,
      createdAt: now,
      date: new Date(t.date),
      description: t.description,
      id: `temp-${Date.now()}-${index}`,
      memberId: null,
      tagId: t.tagId,
      updatedAt: now,
    }));

    return NextResponse.json({ count: expenses.length, expenses, notice, source, success: true });
  } catch (error: unknown) {
    console.error("PDF parsing error:", error);

    const status = (error as { status?: number })?.status ?? 500;
    if (status === 429) {
      return NextResponse.json(
        {
          code: "RATE_LIMIT",
          error: "The AI service is busy. Please wait a minute and try again.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: "The PDF could not be read. Please try again or use a CSV export." },
      { status: status >= 400 && status < 600 ? status : 500 },
    );
  }
}
