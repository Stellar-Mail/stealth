// Issue #1510: API request latency histograms and counters.
// Issue #1518: API service-level objective indicators (SLIs & SLOs).
//
// Default histogram bucket boundaries (in milliseconds) suitable for API
// request durations. These cover sub-5 ms fast-path responses through
// multi-second slow dependencies.
export const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

interface CounterEntry {
  value: number;
}

interface HistogramEntry {
  buckets: Record<string, number>;
  sum: number;
  count: number;
}

export interface SLIResult {
  name: string;
  numerator: number;
  denominator: number;
  ratio: number;
  target: number;
  met: boolean;
}

export interface ComputeSLOOptions {
  excludePaths?: string[];
  excludeSynthetic?: boolean;
}

const DEFAULT_EXCLUDE_PATHS = ["/api/v1/health", "/api/v1/openapi.json"];

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, HistogramEntry>();

function labelKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:"${v}"`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
}

function parseKey(key: string): { name: string; labels: Record<string, string> } {
  const braceIdx = key.indexOf("{");
  if (braceIdx === -1) return { name: key, labels: {} };

  const name = key.slice(0, braceIdx);
  const labelsStr = key.slice(braceIdx + 1, key.length - 1);
  const labels: Record<string, string> = {};

  for (const pair of labelsStr.split(",")) {
    const eqIdx = pair.indexOf(":");
    if (eqIdx !== -1) {
      const k = pair.slice(0, eqIdx).trim();
      const v = pair
        .slice(eqIdx + 1)
        .trim()
        .replace(/^"|"$/g, "");
      labels[k] = v;
    }
  }
  return { name, labels };
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

export function recordAuditEvent(_event: string, _fields: Record<string, string>): void {}

/**
 * Computes the API Availability SLI from accumulated counters.
 * Numerator: Count of non-5xx requests across non-excluded routes.
 * Denominator: Total count of requests across non-excluded routes.
 */
export function computeAvailabilitySLI(options?: ComputeSLOOptions, snap = snapshot()): SLIResult {
  const excludePaths = options?.excludePaths ?? DEFAULT_EXCLUDE_PATHS;
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "api_requests_total") continue;
    if (labels.path && excludePaths.includes(labels.path)) continue;
    if (options?.excludeSynthetic && labels.synthetic === "true") continue;

    denominator += count;
    const status = labels.status ?? "200";
    if (!status.startsWith("5")) {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.999;
  return {
    name: "API Availability SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes the API Latency SLI from accumulated histograms.
 * Numerator: Count of non-5xx requests served within thresholdMs.
 * Denominator: Total count of non-5xx requests.
 */
export function computeLatencySLI(
  thresholdMs = 250,
  options?: ComputeSLOOptions,
  snap = snapshot(),
): SLIResult {
  const excludePaths = options?.excludePaths ?? DEFAULT_EXCLUDE_PATHS;
  let numerator = 0;
  let denominator = 0;

  for (const [key, hist] of Object.entries(snap.histograms)) {
    const { name, labels } = parseKey(key);
    if (name !== "api_latency") continue;
    if (labels.path && excludePaths.includes(labels.path)) continue;
    if (options?.excludeSynthetic && labels.synthetic === "true") continue;
    if (labels.status && labels.status.startsWith("5")) continue;

    denominator += hist.count;
    for (const [bucketName, count] of Object.entries(hist.buckets)) {
      if (bucketName.startsWith("~")) {
        const valStr = bucketName.slice(1);
        if (valStr !== "+Inf") {
          const boundary = Number(valStr);
          if (boundary <= thresholdMs) {
            numerator += count;
          }
        }
      }
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.99;
  return {
    name: `API Latency SLI (<= ${thresholdMs}ms)`,
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Authentication & Authorization Availability SLI.
 * Numerator: Count of non-5xx auth request processing attempts.
 * Denominator: Total count of auth requests processed.
 */
export function computeAuthAvailabilitySLI(
  options?: ComputeSLOOptions,
  snap = snapshot(),
): SLIResult {
  const excludePaths = options?.excludePaths ?? DEFAULT_EXCLUDE_PATHS;
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "api_requests_total") continue;
    if (labels.path && excludePaths.includes(labels.path)) continue;
    if (options?.excludeSynthetic && labels.synthetic === "true") continue;

    const path = labels.path ?? "";
    const isAuth = path.includes("/auth") || path.includes("login") || labels.type === "auth";
    if (!isAuth) continue;

    denominator += count;
    const status = labels.status ?? "200";
    if (!status.startsWith("5")) {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.9995;
  return {
    name: "Authentication Availability SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Critical Postage Transitions SLI.
 * Numerator: Count of successful (2xx), idempotency-replayed (409), or validation-handled (422) postage transitions.
 * Denominator: Total count of postage transition requests processed.
 */
export function computePostageTransitionSLI(
  options?: ComputeSLOOptions,
  snap = snapshot(),
): SLIResult {
  const excludePaths = options?.excludePaths ?? DEFAULT_EXCLUDE_PATHS;
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "api_requests_total") continue;
    if (labels.path && excludePaths.includes(labels.path)) continue;
    if (options?.excludeSynthetic && labels.synthetic === "true") continue;

    const path = labels.path ?? "";
    const isPostage = path.includes("/postage");
    if (!isPostage) continue;

    denominator += count;
    const status = labels.status ?? "200";
    if (status.startsWith("2") || status === "409" || status === "422") {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.999;
  return {
    name: "Critical Postage Transitions SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes a summary of all API Service-Level Indicators.
 */
export function computeSLOSummary(options?: ComputeSLOOptions) {
  const snap = snapshot();
  return {
    availability: computeAvailabilitySLI(options, snap),
    latency: computeLatencySLI(250, options, snap),
    authAvailability: computeAuthAvailabilitySLI(options, snap),
    postageTransitions: computePostageTransitionSLI(options, snap),
  };
}
