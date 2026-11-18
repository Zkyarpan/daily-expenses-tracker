/**
 * GET /api/rates?base=GBP → { base, rates, updatedAt, nextUpdateAt, source }
 *
 * Daily exchange rates for the currency converter (Profile → Currency and
 * /rates). Fetched server-side from ExchangeRate-API's free open endpoint
 * (no key; attribution required — shown under the converter) and cached for
 * 6 hours. Only the base currency code is sent; no user data.
 */

import { z } from "zod";

import { apiError, apiJson } from "@/lib/server/http";

export const runtime = "nodejs";

const SOURCE_URL = "https://open.er-api.com/v6/latest";

const upstreamSchema = z.object({
  base_code: z.string().length(3),
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive()),
  result: z.literal("success"),
  time_last_update_unix: z.number(),
  time_next_update_unix: z.number(),
});

export async function GET(request: Request) {
  const base = (new URL(request.url).searchParams.get("base") ?? "GBP").toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) return apiError(400, "Choose a valid currency code, like GBP.", { field: "base" });

  try {
    const response = await fetch(`${SOURCE_URL}/${base}`, {
      next: { revalidate: 6 * 60 * 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return apiError(502, "Exchange rates aren’t available right now. Please try again later.");
    const parsed = upstreamSchema.safeParse(await response.json());
    if (!parsed.success) return apiError(502, "Exchange rates aren’t available right now. Please try again later.");

    const data = parsed.data;
    return apiJson({
      base: data.base_code,
      nextUpdateAt: new Date(data.time_next_update_unix * 1000).toISOString(),
      rates: data.rates,
      source: { name: "ExchangeRate-API", url: "https://www.exchangerate-api.com" },
      updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(),
    });
  } catch {
    return apiError(503, "Couldn’t reach the exchange-rate service. Check your connection and try again.");
  }
}
