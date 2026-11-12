/**
 * src/lib/perf.ts
 *
 * Tiny timing helper used to report how long the analytics aggregation takes
 * (shown under the analytics page and in the coursework performance notes).
 * The measured duration is diagnostic only: it never changes the computed
 * result, so memoised values stay deterministic for the same inputs.
 */
export function timed<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  return { ms: performance.now() - start, result };
}
