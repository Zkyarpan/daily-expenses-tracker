/**
 * GET /api/profile/export — every expense the caller owns, as a CSV download.
 *
 * Read with the caller's session (RLS + explicit user_id filter). The file is
 * UTF-8 with a byte-order mark so Excel shows "£" correctly; cells are
 * escaped against spreadsheet formula injection.
 */

import { createRateLimiter } from "@/lib/insights/rateLimit";
import { buildExpensesCsv, type ExportRow } from "@/lib/profile/format";
import { apiError, authenticate, logActivity, NO_STORE, tooManyRequests } from "@/lib/profile/server";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 10, minIntervalMs: 2_000, windowMs: 10 * 60_000 });

export async function GET(request: Request) {
  const auth = await authenticate();
  if ("response" in auth) return auth.response;
  const { supabase, user } = auth;

  const decision = limiter.check(user.id);
  if (!decision.allowed) return tooManyRequests(decision, "Please wait a moment before exporting again.");

  let rows: ExportRow[];
  try {
    rows = await fetchExpenseRowsBetween(
      supabase,
      user.id,
      "1900-01-01",
      "2999-12-31",
      "date,description,categoryId,tagId,memberId,amount",
    );
  } catch {
    return apiError(500, "Your expenses could not be exported. Please try again.");
  }

  await logActivity(supabase, user.id, "data_exported", { detail: `${rows.length} expenses`, request });

  const filename = `daily-expenses-export_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`﻿${buildExpensesCsv(rows)}`, {
    headers: {
      ...NO_STORE,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Export-Count": String(rows.length),
    },
  });
}
