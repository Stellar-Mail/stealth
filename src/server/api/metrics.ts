// Issue #1510: API request latency histograms and counters.
//
// Default histogram bucket boundaries (in milliseconds) suitable for API
// request durations. These cover sub-5 ms fast-path responses through
// multi-second slow dependencies.
export const DEFAULT_LATENCY_BUCKETS = [
  5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000,
] as const;

interface CounterEntry {
  value: number;
}

interface HistogramEntry {
  buckets: Record<string, number>;
  sum: number;
  count: number;
}

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, HistogramEntry>();

function labelKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:"${v}"`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
}

function bucketFor(value: number, buckets: readonly number[]): string {
  for (const boundary of buckets) {
    if (value <= boundary) return `~${boundary}`;
  }
  return `~+Inf`;
}

export function incrementCounter(metric: string, labels?: Record<string, string>): void {
  const key = labelKey(metric, labels ?? {});
  const entry = counters.get(key) ?? { value: 0 };
  entry.value += 1;
  counters.set(key, entry);
}

export function recordHistogram(
  metric: string,
  value: number,
  labels?: Record<string, string>,
  buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
): void {
  const key = labelKey(metric, labels ?? {});
  const entry = histograms.get(key) ?? { buckets: {}, sum: 0, count: 0 };
  const bucket = bucketFor(value, buckets);
  entry.buckets[bucket] = (entry.buckets[bucket] ?? 0) + 1;
  entry.sum += value;
  entry.count += 1;
  histograms.set(key, entry);
}

/**
 * Returns a snapshot of all accumulated metrics data.
 * Useful for test assertions and for building a /metrics endpoint.
 */
export function snapshot(): {
  counters: Record<string, number>;
  histograms: Record<string, { buckets: Record<string, number>; sum: number; count: number }>;
} {
  const counterSnapshot: Record<string, number> = {};
  for (const [key, entry] of counters) {
    counterSnapshot[key] = entry.value;
  }

  const histogramSnapshot: Record<
    string,
    { buckets: Record<string, number>; sum: number; count: number }
  > = {};
  for (const [key, entry] of histograms) {
    histogramSnapshot[key] = {
      buckets: { ...entry.buckets },
      sum: entry.sum,
      count: entry.count,
    };
  }

  return { counters: counterSnapshot, histograms: histogramSnapshot };
}

/**
 * Resets all collected metrics. Useful between tests or before fresh
 * measurement windows.
 */
export function reset(): void {
  counters.clear();
  histograms.clear();
}
