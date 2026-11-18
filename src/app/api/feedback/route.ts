/**
 * /api/feedback — the Help page's "Report a problem / Send feedback" form.
 *
 *   POST { kind, subject, message, page?, contactOk, device? } → { id, reference }
 *   GET                                                         → { reports: FeedbackRecord[] }
 *
 * Signed-in users only; same-origin JSON, validated with the shared schema
 * (src/lib/feedback/schemas.ts), rate limited. Rows are private to their
 * author (RLS). DB: supabase/migrations/20261120000000_create_feedback.sql
 */

import { type FeedbackRecord, feedbackReference, feedbackSchema } from "@/lib/feedback/schemas";
import { createRateLimiter } from "@/lib/insights/rateLimit";
import { isSetupError } from "@/lib/money/server";
import { apiError, apiJson, authenticate, readJsonBody, tooManyRequests } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 6 reports per 10 minutes, at least 5 s apart — plenty for people, a wall for scripts. */
const limiter = createRateLimiter({ limit: 6, minIntervalMs: 5_000, windowMs: 10 * 60_000 });

const NOT_READY =
  "We couldn’t send this just now — the feedback inbox isn’t set up on this server yet. Your message is still in the form, so you can try again later.";

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("feedback")
    .select('id, kind, subject, page, status, "createdAt"')
    .order("createdAt", { ascending: false })
    .limit(20);

  if (error) {
    // Not set up yet: there simply are no earlier reports to show.
    if (isSetupError(error)) return apiJson({ reports: [] as FeedbackRecord[], setupRequired: true });
    return apiError(500, "Your earlier reports could not be loaded.");
  }
  return apiJson({ reports: (data ?? []) as FeedbackRecord[] });
}

export async function POST(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Thanks — we’ve got your last message. Please wait a moment before sending another.");

  const body = await readJsonBody(request, feedbackSchema, 8_192);
  if ("response" in body) return body.response;
  const input = body.data;

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      contactOk: input.contactOk,
      device: input.device ?? null,
      kind: input.kind,
      message: input.message,
      page: input.page || null,
      subject: input.subject,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (isSetupError(error)) return apiError(503, NOT_READY, { setupRequired: true });
    console.warn("[feedback] insert failed:", error.code ?? "error");
    return apiError(500, "Your message couldn’t be sent. Please try again.");
  }
  return apiJson({ id: data.id as string, reference: feedbackReference(data.id as string) }, 201);
}
