/**
 * src/lib/supabase/queries.ts
 *
 * Read helpers that take the Supabase client as a parameter, so the same
 * code runs in the browser (singleton client) and on the server (cookie-
 * based client in route handlers). No client is imported here.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True when PostgREST reports that a table does not exist (e.g. a migration
 * not applied yet) — callers show "not set up", not an error.
 */
export function isMissingTableError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ((error as { code: string }).code === "PGRST205" ||
      (error as { code: string }).code === "42P01")
  );
}

/** PostgREST returns at most 1,000 rows per request by default. */
export const PAGE_SIZE = 1000;
/** Safety cap: 100 pages = 100,000 rows per date window. */
export const MAX_PAGES = 100;

/**
 * All of one user's expense rows in an inclusive date window, paged so totals
 * are never silently truncated at the PostgREST row limit.
 *
 * Security: RLS (user_id = auth.uid()) is the real enforcement; the explicit
 * user_id filter is defence in depth.
 */
export async function fetchExpenseRowsBetween(
  client: SupabaseClient,
  userId: string,
  startDate: string, // YYYY-MM-DD, inclusive
  endDate: string, // YYYY-MM-DD, inclusive
  /** Columns to read. Pass a narrow list to minimise data (e.g. AI insights). */
  columns = "*",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await client
      .from("expenses")
      .select(columns)
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false })
      .order("id", { ascending: true }) // stable order across pages
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}
