/**
 * API Metrics & Observability Architecture
 *
 * This module provides a modular, fault-tolerant, and observable metrics abstraction
 * for the Stealth API.
 *
 * ## Metrics Registry & Names
 * All metric names use consistent `snake_case` naming conventions:
 *
 * 1. `api_requests_total`: Total count of processed API requests.
 *    - Purpose: Track API throughput, overall traffic, and success/failure distribution.
 *    - Labels: `method` (HTTP method), `path` (route path), `status` (HTTP status code), `outcome` ("success" | "error").
 *
 * 2. `api_errors_total`: Total count of API request errors.
 *    - Purpose: Monitor system error rate and HTTP error responses.
 *    - Labels: `method`, `path`, `status`.
 *
 * 3. `api_latency`: Request latency distribution histogram in milliseconds.
 *    - Purpose: Compute response time percentiles and latency SLIs/SLOs.
 *    - Labels: `method`, `path`, `status`.
 *
 * 4. `auth_failures_total`: Count of authentication and authorization rejections.
 *    - Purpose: Security monitoring, detecting brute-force or unauthenticated access attempts.
 *    - Labels: `reason` (e.g. "unauthorized", "forbidden", "invalid_delegation").
 *
 * 5. `rate_limit_hits_total`: Count of rate-limiting quota rejections.
 *    - Purpose: Monitor rate-limiter enforcement and identify abusive actors.
 *    - Labels: `type` ("account" | "ip" | "device" | "sender_recipient" | "relay"), `operation` (optional).
 *
 * 6. `domain_transition_total`: Count of state transitions in domain models (postage, idempotency).
 *    - Purpose: Audit critical domain state changes (e.g. postage settlement, idempotency completion).
 *    - Labels: `entity` ("postage" | "idempotency"), `from` (previous state), `to` (new state).
 *
 * ## Adapter Architecture
 * The system is built around the `Metrics` interface and pluggable adapters:
 * - `InMemoryMetricsAdapter`: Deterministic, in-memory adapter designed for unit tests and local state.
 * - `ProductionMetricsAdapter`: Production-ready adapter that aggregates observable metrics and exposes formatters for Prometheus, StatsD, or OpenTelemetry integrations.
 * - `SafeMetricsAdapter`: Fault-tolerant wrapper ensuring that metrics collection errors are safely logged and NEVER throw into request handlers.
 *
 * ## Usage Example
 * ```ts
 * import { incrementCounter, getCounter, setMetricsAdapter, ProductionMetricsAdapter } from "./metrics";
 *
 * // Switch adapter if needed (default is InMemoryMetricsAdapter safely wrapped)
 * setMetricsAdapter(new ProductionMetricsAdapter());
 *
 * // Increment counter with labels
 * incrementCounter("api_requests_total", 1, { method: "POST", path: "/api/v1/postage", status: "200" });
 *
 * // Read metric in tests or status endpoints
 * const count = getCounter("api_requests_total", { method: "POST", path: "/api/v1/postage", status: "200" });
 * ```
 */

// Issue #1510: API request latency histograms and counters.
// Issue #1518: API service-level objective indicators (SLIs & SLOs).

/** Default histogram bucket boundaries (in milliseconds) suitable for API request durations. */
export const DEFAULT_LATENCY_BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

export interface CounterEntry {
  value: number;
}

export interface HistogramEntry {
  buckets: Record<string, number>;
  sum: number;
  count: number;
}

export interface MetricsSnapshot {
  counters: Record<string, number>;
  histograms: Record<string, HistogramEntry>;
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

/**
 * Common Metrics interface.
 * Design enables future additions (e.g. gauges, summaries) without refactoring caller code.
 */
export interface Metrics {
  incrementCounter(
    name: string,
    valueOrLabels?: number | Record<string, string>,
    labels?: Record<string, string>,
  ): void;

  recordHistogram?(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets?: readonly number[],
  ): void;

  getCounter?(name: string, labels?: Record<string, string>): number;

  reset?(): void;

  snapshot?(): MetricsSnapshot;
}

/** Helper to generate consistent metric keys with sorted label pairs. */
export function labelKey(name: string, labels?: Record<string, string>): string {
  if (!labels) return name;
  const entries = Object.entries(labels);
  if (entries.length === 0) return name;
  const parts = entries.sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:"${v}"`);
  return `${name}{${parts.join(",")}}`;
}

/** Helper to parse composite key back into metric name and label dictionary. */
export function parseKey(key: string): { name: string; labels: Record<string, string> } {
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

function parseIncrementArgs(
  valueOrLabels?: number | Record<string, string>,
  labelsArg?: Record<string, string>,
): { value: number; labels?: Record<string, string> } {
  if (typeof valueOrLabels === "number") {
    return { value: valueOrLabels, labels: labelsArg };
  }
  if (typeof valueOrLabels === "object" && valueOrLabels !== null) {
    return { value: 1, labels: valueOrLabels };
  }
  return { value: 1, labels: labelsArg };
}

/**
 * In-Memory Adapter for tests and local execution.
 * Stores counter and histogram values deterministically in memory.
 */
export class InMemoryMetricsAdapter implements Metrics {
  private counters = new Map<string, CounterEntry>();
  private histograms = new Map<string, HistogramEntry>();

  incrementCounter(
    name: string,
    valueOrLabels?: number | Record<string, string>,
    labelsArg?: Record<string, string>,
  ): void {
    const { value, labels } = parseIncrementArgs(valueOrLabels, labelsArg);
    const key = labelKey(name, labels);
    const entry = this.counters.get(key) ?? { value: 0 };
    entry.value += value;
    this.counters.set(key, entry);
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
  ): void {
    const key = labelKey(name, labels);
    const entry = this.histograms.get(key) ?? { buckets: {}, sum: 0, count: 0 };
    const bucket = bucketFor(value, buckets);
    entry.buckets[bucket] = (entry.buckets[bucket] ?? 0) + 1;
    entry.sum += value;
    entry.count += 1;
    this.histograms.set(key, entry);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    if (labels && Object.keys(labels).length > 0) {
      const key = labelKey(name, labels);
      return this.counters.get(key)?.value ?? 0;
    }

    // Exact no-label match first
    const exact = this.counters.get(name);
    if (exact !== undefined) {
      return exact.value;
    }

    // Aggregated match for all metric instances starting with name + "{"
    let total = 0;
    let found = false;
    const prefix = `${name}{`;

    for (const [k, entry] of this.counters) {
      if (k === name || k.startsWith(prefix)) {
        total += entry.value;
        found = true;
      }
    }

    return found ? total : 0;
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  snapshot(): MetricsSnapshot {
    const counterSnapshot: Record<string, number> = {};
    for (const [key, entry] of this.counters) {
      counterSnapshot[key] = entry.value;
    }

    const histogramSnapshot: Record<string, HistogramEntry> = {};
    for (const [key, entry] of this.histograms) {
      histogramSnapshot[key] = {
        buckets: { ...entry.buckets },
        sum: entry.sum,
        count: entry.count,
      };
    }

    return { counters: counterSnapshot, histograms: histogramSnapshot };
  }
}

/**
 * Production Adapter.
 * Aggregates observable metric measurements and integrates cleanly with external monitoring backends
 * such as Prometheus, OpenTelemetry, or StatsD without requiring application code changes.
 */
export class ProductionMetricsAdapter implements Metrics {
  private inMemory = new InMemoryMetricsAdapter();
  private listeners: Array<(name: string, value: number, labels?: Record<string, string>) => void> =
    [];

  constructor(options?: {
    onRecord?: (name: string, value: number, labels?: Record<string, string>) => void;
  }) {
    if (options?.onRecord) {
      this.listeners.push(options.onRecord);
    }
  }

  addListener(
    listener: (name: string, value: number, labels?: Record<string, string>) => void,
  ): void {
    this.listeners.push(listener);
  }

  incrementCounter(
    name: string,
    valueOrLabels?: number | Record<string, string>,
    labelsArg?: Record<string, string>,
  ): void {
    const { value, labels } = parseIncrementArgs(valueOrLabels, labelsArg);
    this.inMemory.incrementCounter(name, value, labels);

    for (const listener of this.listeners) {
      try {
        listener(name, value, labels);
      } catch (err) {
        console.error(`[ProductionMetricsAdapter] Listener error for "${name}":`, err);
      }
    }
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
  ): void {
    this.inMemory.recordHistogram(name, value, labels, buckets);
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    return this.inMemory.getCounter(name, labels);
  }

  reset(): void {
    this.inMemory.reset();
  }

  snapshot(): MetricsSnapshot {
    return this.inMemory.snapshot();
  }

  /** Formats recorded metrics into Prometheus exposition text format. */
  toPrometheusFormat(): string {
    const snap = this.snapshot();
    const lines: string[] = [];

    for (const [key, count] of Object.entries(snap.counters)) {
      const { name, labels } = parseKey(key);
      const labelPairs = Object.entries(labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const formattedKey = labelPairs ? `${name}{${labelPairs}}` : name;
      lines.push(`${formattedKey} ${count}`);
    }

    return lines.join("\n");
  }
}

/**
 * Fault-tolerant wrapper that guards adapter calls.
 * Ensures metrics failures are logged and NEVER throw exceptions into request handlers.
 */
export class SafeMetricsAdapter implements Metrics {
  constructor(private inner: Metrics) {}

  incrementCounter(
    name: string,
    valueOrLabels?: number | Record<string, string>,
    labelsArg?: Record<string, string>,
  ): void {
    try {
      this.inner.incrementCounter(name, valueOrLabels, labelsArg);
    } catch (error) {
      console.error(`[Metrics] Exception emitting counter "${name}":`, error);
    }
  }

  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
  ): void {
    try {
      if (this.inner.recordHistogram) {
        this.inner.recordHistogram(name, value, labels, buckets);
      }
    } catch (error) {
      console.error(`[Metrics] Exception emitting histogram "${name}":`, error);
    }
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    try {
      return this.inner.getCounter ? this.inner.getCounter(name, labels) : 0;
    } catch (error) {
      console.error(`[Metrics] Exception reading counter "${name}":`, error);
      return 0;
    }
  }

  reset(): void {
    try {
      if (this.inner.reset) {
        this.inner.reset();
      }
    } catch (error) {
      console.error(`[Metrics] Exception resetting metrics:`, error);
    }
  }

  snapshot(): MetricsSnapshot {
    try {
      if (this.inner.snapshot) {
        return this.inner.snapshot();
      }
    } catch (error) {
      console.error(`[Metrics] Exception taking metrics snapshot:`, error);
    }
    return { counters: {}, histograms: {} };
  }
}

// Global active metrics adapter (default to in-memory wrapped safely)
let activeAdapter: Metrics = new SafeMetricsAdapter(new InMemoryMetricsAdapter());

/** Sets the global metrics adapter. */
export function setMetricsAdapter(adapter: Metrics): void {
  activeAdapter = new SafeMetricsAdapter(adapter);
}

/** Gets the active metrics adapter. */
export function getMetricsAdapter(): Metrics {
  return activeAdapter;
}

/** Increments a named counter. Safe for call sites; will never throw. */
export function incrementCounter(
  metric: string,
  valueOrLabels?: number | Record<string, string>,
  labels?: Record<string, string>,
): void {
  activeAdapter.incrementCounter(metric, valueOrLabels, labels);
}

/** Records a histogram sample. Safe for call sites; will never throw. */
export function recordHistogram(
  metric: string,
  value: number,
  labels?: Record<string, string>,
  buckets: readonly number[] = DEFAULT_LATENCY_BUCKETS,
): void {
  if (activeAdapter.recordHistogram) {
    activeAdapter.recordHistogram(metric, value, labels, buckets);
  }
}

/** Returns the current value of a counter. Safe for call sites; will never throw. */
export function getCounter(metric: string, labels?: Record<string, string>): number {
  return activeAdapter.getCounter ? activeAdapter.getCounter(metric, labels) : 0;
}

/** Returns a snapshot of all accumulated metrics data. */
export function snapshot(): MetricsSnapshot {
  return activeAdapter.snapshot ? activeAdapter.snapshot() : { counters: {}, histograms: {} };
}

/** Resets all collected metrics. */
export function reset(): void {
  if (activeAdapter.reset) {
    activeAdapter.reset();
  }
}

const DEFAULT_EXCLUDE_PATHS = ["/api/v1/health", "/api/v1/openapi.json"];

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
