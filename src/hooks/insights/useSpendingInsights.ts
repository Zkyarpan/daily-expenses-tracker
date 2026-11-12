/**
 * src/hooks/insights/useSpendingInsights.ts
 *
 * Feature 7: client hook for POST /api/insights. The browser sends only the
 * month to analyse; all figures are calculated on the server from the
 * signed-in user's own records.
 */

import { useMutation } from "@tanstack/react-query";

import type { InsightsRequest, InsightsResponse } from "@/entities/Insights";

/** Slightly longer than the server's 20 s AI timeout, so the server answers first. */
export const CLIENT_TIMEOUT_MS = 35_000;

export class InsightsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "InsightsRequestError";
  }
}

export async function requestInsights(body: InsightsRequest): Promise<InsightsResponse> {
  let response: Response;
  try {
    response = await fetch("/api/insights", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new InsightsRequestError("The request took too long. Please try again.", 408);
    }
    throw new InsightsRequestError("Couldn't reach the server. Check your connection and try again.", 0);
  }

  const data = (await response.json().catch(() => null)) as
    | (InsightsResponse & { error?: never })
    | { error?: string; retryAfterSeconds?: number }
    | null;

  if (!response.ok || !data || "error" in data) {
    const message =
      (data && "error" in data && data.error) ||
      (response.status === 401 ? "Please sign in again." : "Insights could not be generated. Please try again.");
    const retryAfter =
      (data && "retryAfterSeconds" in data && data.retryAfterSeconds) ||
      Number(response.headers.get("retry-after")) ||
      undefined;
    throw new InsightsRequestError(message, response.status, retryAfter);
  }
  return data as InsightsResponse;
}

export const useSpendingInsights = () =>
  useMutation<InsightsResponse, InsightsRequestError, InsightsRequest>({
    mutationFn: requestInsights,
    retry: false,
  });
