/**
 * src/lib/feedback/schemas.ts — contract for the Help page's report form
 * (POST/GET /api/feedback). Shared by the browser form and the route
 * handler so both validate the same way. DB: 20261120000000_create_feedback.sql
 */

import { z } from "zod";

export const FEEDBACK_KINDS = [
  { description: "Something isn’t working or looks wrong", id: "problem", label: "Report a problem" },
  { description: "A total, budget or chart doesn’t add up", id: "wrong_data", label: "Numbers look wrong" },
  { description: "Something that would make the app better", id: "idea", label: "Suggest an idea" },
  { description: "Not sure how something works", id: "question", label: "Ask a question" },
  { description: "Anything else on your mind", id: "other", label: "Something else" },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]["id"];
const kindIds = FEEDBACK_KINDS.map((k) => k.id) as [FeedbackKind, ...FeedbackKind[]];

export const FEEDBACK_STATUS_LABEL = { in_review: "In review", new: "Received", resolved: "Resolved" } as const;
export type FeedbackStatus = keyof typeof FEEDBACK_STATUS_LABEL;

/** No control characters (other than line breaks in the message). */
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();

export const feedbackSchema = z.strictObject({
  contactOk: z.boolean().default(true),
  device: z
    .strictObject({
      appVersion: z.string().max(40).optional(),
      language: z.string().max(40).optional(),
      screen: z.string().max(40).optional(),
      userAgent: z.string().max(400).optional(),
    })
    .nullish(),
  kind: z.enum(kindIds, { error: "Choose what this is about." }),
  message: z
    .string()
    .transform(clean)
    .pipe(
      z
        .string()
        .min(10, "Tell us a little more — at least 10 characters.")
        .max(2000, "Keep it under 2,000 characters."),
    ),
  page: z.string().trim().max(200).nullish(),
  subject: z
    .string()
    .transform(clean)
    .pipe(z.string().min(3, "Add a short subject.").max(120, "Keep the subject under 120 characters.")),
});

export type FeedbackInput = z.input<typeof feedbackSchema>;

export interface FeedbackRecord {
  createdAt: string;
  id: string;
  kind: FeedbackKind;
  page: string | null;
  status: FeedbackStatus;
  subject: string;
}

/** Short reference shown after sending, e.g. "FB-3F9A2C". */
export const feedbackReference = (id: string) => `FB-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
