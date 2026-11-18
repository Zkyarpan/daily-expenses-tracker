/**
 * src/lib/api/rates.ts — exchange rates for the currency converter.
 */

import { useQuery } from "@tanstack/react-query";

import { request } from "./client";

export interface RatesResponse {
  base: string;
  nextUpdateAt: string;
  rates: Record<string, number>;
  source: { name: string; url: string };
  updatedAt: string;
}

/** Rates against `base` (1 base = rates[code] code). Refreshed hourly while open. */
export function useRates(base: string) {
  return useQuery({
    queryFn: () => request<RatesResponse>(`/api/rates?base=${encodeURIComponent(base)}`),
    queryKey: ["rates", base],
    refetchInterval: 60 * 60_000,
    retry: 1,
    staleTime: 30 * 60_000,
  });
}

/** Converts between any two currencies using one table of rates. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>, base: string) {
  const inBase = from === base ? amount : amount / (rates[from] ?? NaN);
  return to === base ? inBase : inBase * (rates[to] ?? NaN);
}
