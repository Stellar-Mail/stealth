// Issue #1510: API request latency histograms and counters.
// Issue #1518: API service-level objective indicators (SLIs & SLOs).
// Issue #1990 (BETA-083): Load-test metrics for chain queues, storage, relay, and idempotency.

export const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

interface CounterEntry {
  value: number;
}

interface HistogramEntry {
  buckets: Record<string, number>;
  sum: number;
  count: number;
}

interface GaugeEntry {
  value: number;
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

const DEFAULT_EXCLUDE_PATHS = ["/api/v1/health", "/api/v1/openapi.json", "/metrics"];

const counters = new Map<string, CounterEntry>();
const histograms = new Map<string, HistogramEntry>();
const gauges = new Map<string, GaugeEntry>();

function labelKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:"${v}"`);
  return parts.length ? `${name}{${parts.join(",")}}` : name;
}

function parseKey(key: string): {
  name: string;
  labels: Record<string, string>;
} {
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

export const METRIC_DESCRIPTORS = {
  // Existing HTTP & Abuse Descriptors
  api_requests_total: ["method", "path", "status", "type", "synthetic"],
  api_latency: ["method", "path", "status", "type", "synthetic"],
  api_errors_total: ["method", "path", "status", "type", "synthetic", "error_type"],
  abuse_dependency_fallback: ["check", "decision", "errorType", "policy", "route"],
  postage_limit_rejected: ["limit", "actorId", "ip", "fingerprint", "sender", "relayId"],
  abuse_disposable_email_blocked: ["domain"],
  abuse_invite_code_invalid: ["code"],
  abuse_verification_token_locked: ["tokenId"],

  // BETA-083 Additions: Relay, Storage, Chain Queues & Idempotency
  signup_burst_duration_ms: ["stage", "status"],
  mailbox_sync_latency_ms: ["userId", "syncType"],
  storage_upload_latency_ms: ["operation", "status", "mimeType"],
  object_storage_operations_total: ["operation", "status"],
  chain_queue_age_seconds: ["queueName", "provider"],
  idempotency_violations_total: ["route", "actorId"],
  rpc_pressure_requests_total: ["provider", "method", "status"],
} as const;

export type MetricName = keyof typeof METRIC_DESCRIPTORS;

function validateLabels(metric: string, labels: Record<string, string>) {
  const allowedLabels = METRIC_DESCRIPTORS[metric as MetricName];
  if (!allowedLabels) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error(`Unknown metric name: ${metric}`);
    }
    return;
  }
  for (const key of Object.keys(labels)) {
    if (!(allowedLabels as readonly string[]).includes(key)) {
      if (process.env.NODE_ENV !== "production") {
        throw new Error(`Unknown label '${key}' for metric '${metric}'`);
      }
      delete labels[key];
    }
  }
}

export function incrementCounter(metric: string, labels?: Record<string, string>, amount = 1): void {
  const safeLabels = { ...labels };
  validateLabels(metric, safeLabels);
  const key = labelKey(metric, safeLabels);
  const entry = counters.get(key) ?? { value: 0 };
  entry.value += amount;
  counters.set(key, entry);
}

export function setGauge(metric: string, value: number, labels?: Record<string, string>): void {
  const safeLabels = { ...labels };
  validateLabels(metric, safeLabels);
  const key = labelKey(metric, safeLabels);
  gauges.set(key, { value });
}

export function recordHistogram(
  metric: string,
  value: number,
  labels?: Record<string, string>,
  buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
): void {
  const safeLabels = { ...labels };
  validateLabels(metric, safeLabels);
  const key = labelKey(metric, safeLabels);
  const entry = histograms.get(key) ?? { buckets: {}, sum: 0, count: 0 };
  const bucket = bucketFor(value, buckets);
  entry.buckets[bucket] = (entry.buckets[bucket] ?? 0) + 1;
  entry.sum += value;
  entry.count += 1;
  histograms.set(key, entry);
}

/**
 * Returns a snapshot of all accumulated metrics data.
 */
export function snapshot(): {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, { buckets: Record<string, number>; sum: number; count: number }>;
} {
  const counterSnapshot: Record<string, number> = {};
  for (const [key, entry] of counters) {
    counterSnapshot[key] = entry.value;
  }

  const gaugeSnapshot: Record<string, number> = {};
  for (const [key, entry] of gauges) {
    gaugeSnapshot[key] = entry.value;
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

  return { counters: counterSnapshot, gauges: gaugeSnapshot, histograms: histogramSnapshot };
}

/**
 * Renders stored metrics in Prometheus text format for /metrics scraping.
 */
export function renderPrometheusMetrics(): string {
  const lines: string[] = [];
  const snap = snapshot();

  for (const [key, val] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
    lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${val}`);
  }

  for (const [key, val] of Object.entries(snap.gauges)) {
    const { name, labels } = parseKey(key);
    const labelStr = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
    lines.push(`${name}${labelStr ? `{${labelStr}}` : ''} ${val}`);
  }

  for (const [key, hist] of Object.entries(snap.histograms)) {
    const { name, labels } = parseKey(key);
    const labelBase = Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(",");
    lines.push(`${name}_sum${labelBase ? `{${labelBase}}` : ''} ${hist.sum}`);
    lines.push(`${name}_count${labelBase ? `{${labelBase}}` : ''} ${hist.count}`);
  }

  return lines.join("\n");
}

export function reset(): void {
  counters.clear();
  gauges.clear();
  histograms.clear();
}

export function recordAuditEvent(_event: string, _fields: Record<string, string>): void {}

// SLI / SLO Computation Utilities
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

export function computeSLOSummary(options?: ComputeSLOOptions) {
  const snap = snapshot();
  return {
    availability: computeAvailabilitySLI(options, snap),
    latency: computeLatencySLI(250, options, snap),
  };
}