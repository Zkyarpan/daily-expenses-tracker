/**
 * GET /api/profile/activity — the caller's 25 most recent account events
 * (password changes, email change requests, sign-outs, exports…).
 */

import type { ActivityEvent, ActivityResponse } from "@/lib/profile/schemas";
import { apiError, apiJson, authenticate } from "@/lib/profile/server";
import { isMissingTableError } from "@/lib/supabase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("account_activity")
    .select("id, event, detail, device, createdAt")
    .eq("user_id", auth.user.id)
    .order("createdAt", { ascending: false })
    .limit(25);

  if (error) {
    if (isMissingTableError(error)) return apiJson<ActivityResponse>({ available: false, events: [] });
    return apiError(500, "Your activity could not be loaded. Please try again.");
  }
  return apiJson<ActivityResponse>({ available: true, events: (data ?? []) as ActivityEvent[] });
}
