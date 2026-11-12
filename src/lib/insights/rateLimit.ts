/**
 * src/lib/insights/rateLimit.ts
 *
 * Feature 7: per-user request limiting for POST /api/insights.
 *
 * Two rules, both per user ID:
 *  - a minimum gap between requests (stops double-clicks and loops), and
 *  - a maximum number of requests in a rolling window (caps AI spend).
 *
 * In-memory: correct for a single server process (local dev, one Node
 * instance). On multi-instance/serverless hosting each instance keeps its own
 * counters, so a shared store (e.g. Redis or a Supabase table) would be
 * needed there — documented as a known limitation.
 */

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  minIntervalMs: number;
  now?: () => number;
};

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number; reason: "too_soon" | "window_exhausted" };

export function createRateLimiter({ limit, minIntervalMs, now = Date.now, windowMs }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitDecision {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);

      const last = recent[recent.length - 1];
      if (last !== undefined && t - last < minIntervalMs) {
        hits.set(key, recent);
        return { allowed: false, reason: "too_soon", retryAfterSeconds: Math.ceil((minIntervalMs - (t - last)) / 1000) };
      }
      if (recent.length >= limit) {
        hits.set(key, recent);
        return {
          allowed: false,
          reason: "window_exhausted",
          retryAfterSeconds: Math.ceil((windowMs - (t - recent[0])) / 1000),
        };
      }

      recent.push(t);
      hits.set(key, recent);
      // Opportunistic cleanup so the map cannot grow without bound.
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
      }
      return { allowed: true, remaining: limit - recent.length };
    },
  };
}
