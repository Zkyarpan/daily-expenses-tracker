/**
 * src/lib/api/ai.ts — browser client for the AI features:
 * receipt scanning (/api/receipts/scan) and the assistant (/api/assistant).
 */

import type { AssistantAnswer } from "@/lib/assistant/answer";
import type { AssistantContext } from "@/lib/assistant/query";
import type { ReceiptDraft } from "@/lib/receipts/receipt";

import { json, request } from "./client";
import { localToday } from "./money";

export const aiApi = {
  ask: (input: { context?: AssistantContext; previousQuestion?: string | null; question: string }) =>
    request<{ answer: AssistantAnswer; understoodBy: "ai" | "rules" }>(
      `/api/assistant?today=${localToday()}`,
      json("POST", input),
    ),
  scanReceipt: (image: string) =>
    request<{ receipt: ReceiptDraft }>(`/api/receipts/scan?today=${localToday()}`, json("POST", { image })),
};

/**
 * Prepares a photo for upload: decodes it, scales the longest side to at most
 * `maxSide` px and re-encodes it as JPEG. Re-encoding also drops EXIF
 * metadata (e.g. the GPS location a phone camera adds).
 */
export async function prepareReceiptImage(file: File, maxSide = 1600): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG or HEIC).");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large.");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("This photo format can’t be opened here — try a JPEG or PNG, or a screenshot."));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn’t process the photo.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
