/**
 * src/lib/api/feedback.ts — browser client for the Help page's report form.
 */

import type { FeedbackInput, FeedbackRecord } from "@/lib/feedback/schemas";

import { json, request } from "./client";

export const feedbackApi = {
  list: () => request<{ reports: FeedbackRecord[]; setupRequired?: boolean }>("/api/feedback"),
  send: (input: FeedbackInput) => request<{ id: string; reference: string }>("/api/feedback", json("POST", input)),
};
