/**
 * src/lib/spendingQueries.ts
 *
 * Cache invalidation after any expense write (create, edit, delete, bulk
 * save, import). No React, so it is unit-testable with a QueryClient.
 */

import type { QueryClient } from "@tanstack/react-query";

/**
 * Marks every cached expenses month, budgets query and yearly cache stale.
 *
 * All months, not just the month the page shows: the Add Expense dialog can
 * date an expense outside it (Today while viewing October), an edit can move
 * one to another month, and imports span months. Invalidating only the page's
 * month left the other month's cache, and its budget alerts, stale for up to
 * five minutes (the query staleTime). Only queries on screen refetch now; the
 * rest refetch when next used.
 */
export function invalidateSpendingQueries(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    queryClient.invalidateQueries({ queryKey: ["budgets"] }),
    queryClient.invalidateQueries({ queryKey: ["yearly-expenses"] }),
  ]);
}
