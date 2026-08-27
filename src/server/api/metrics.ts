// Issue #1510: API request latency histograms and counters.
// Issue #1518: API service-level objective indicators (SLIs & SLOs).
// Issue #1999 (BETA-092): RED/USE metrics across live account, relay, chain, storage, sync, delivery, and web workflows.
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
  // API Core
  api_requests_total: ["method", "path", "status", "type", "synthetic"],
  api_latency: ["method", "path", "status", "type", "synthetic"],
  api_errors_total: ["method", "path", "status", "type", "synthetic", "error_type"],
  abuse_dependency_fallback: ["check", "decision", "errorType", "policy", "route"],
  postage_limit_rejected: ["limit", "actorId", "ip", "fingerprint", "sender", "relayId"],
  abuse_disposable_email_blocked: ["domain"],
  abuse_invite_code_invalid: ["code"],
  abuse_verification_token_locked: ["tokenId"],
  abuse_throttled: ["route", "type", "subject"],
  abuse_storage_bytes_exceeded: ["route", "subject", "limit"],
  abuse_chain_writes_exceeded: ["route", "subject", "limit"],
  abuse_operator_override: ["route", "operatorId"],
  abuse_recipient_exceeded: ["route", "recipient", "limit"],
  abuse_session_exceeded: ["route", "sessionId", "limit"],

  // 1. Auth & Session Management (RED / USE)
  auth_requests_total: ["operation", "status", "outcome"],
  auth_latency: ["operation", "status"],
  auth_errors_total: ["operation", "error_type"],
  auth_active_sessions: ["method"],

  // 2. Account Provisioning (RED)
  provisioning_operations_total: ["step", "status", "outcome"],
  provisioning_latency: ["step", "status"],
  provisioning_errors_total: ["step", "error_type"],

  // 3. Relay Dispatch & Delivery (RED / USE)
  relay_requests_total: ["stage", "status", "delivery_state"],
  relay_latency: ["stage", "status"],
  relay_errors_total: ["stage", "error_type"],
  relay_retry_count: ["stage", "reason"],

  // 4. Envelope Storage (R2 / KV / Memory) (RED / USE)
  storage_operations_total: ["backend", "operation", "status"],
  storage_latency: ["backend", "operation"],
  storage_errors_total: ["backend", "operation", "error_type"],
  storage_utilization_ratio: ["backend"],

  // 5. Mailbox & Message Sync (RED / USE)
  sync_operations_total: ["operation", "status"],
  sync_latency: ["operation", "status"],
  sync_errors_total: ["operation", "error_type"],
  sync_gaps_detected_total: ["stream_type"],

  // 6. Chain Queues & Soroban Operations (RED / USE)
  chain_queue_depth: ["queue_name", "status"],
  chain_queue_operations_total: ["operation", "status", "outcome"],
  chain_queue_latency: ["operation", "status"],
  chain_queue_errors_total: ["operation", "error_type"],
  chain_dead_letters_total: ["job_type", "error_code"],

  // 7. Delivery State Transitions (RED)
  delivery_operations_total: ["stage", "status", "outcome"],
  delivery_latency: ["stage", "status"],
  delivery_errors_total: ["stage", "error_type"],
  delivery_stage_transitions_total: ["from_stage", "to_stage", "status"],
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

export function incrementCounter(metric: string, labels?: Record<string, string>): void {
  const safeLabels = { ...labels };
  validateLabels(metric, safeLabels);
  const key = labelKey(metric, safeLabels);
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

  // Process standard api_requests_total with auth path or type
  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name === "auth_requests_total") {
      denominator += count;
      const status = labels.status ?? "200";
      const outcome = labels.outcome ?? "success";
      if (!status.startsWith("5") && outcome !== "unexpected_error") {
        numerator += count;
      }
      continue;
    }

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
 * Computes Relay Delivery SLI.
 * Numerator: Successful relay submissions (delivered, ACKNOWLEDGED, DEDUPLICATED, non-5xx).
 * Denominator: Total relay submission attempts.
 */
export function computeRelayDeliverySLI(options?: ComputeSLOOptions, snap = snapshot()): SLIResult {
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "relay_requests_total") continue;

    denominator += count;
    const status = labels.status ?? "200";
    const state = (labels.delivery_state ?? "").toUpperCase();
    const isSuccess =
      !status.startsWith("5") &&
      (state === "ACKNOWLEDGED" ||
        state === "DEDUPLICATED" ||
        state === "DELIVERED" ||
        status.startsWith("2") ||
        state === "");

    if (isSuccess) {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.995;
  return {
    name: "Relay Delivery SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Chain Queue SLI.
 * Numerator: Count of successfully executed / settled chain queue jobs.
 * Denominator: Total chain queue operations executed + dead letters recorded.
 */
export function computeChainQueueSLI(options?: ComputeSLOOptions, snap = snapshot()): SLIResult {
  let successful = 0;
  let failed = 0;
  let deadLetters = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name === "chain_queue_operations_total") {
      const outcome = labels.outcome ?? "success";
      const status = labels.status ?? "200";
      if (outcome === "success" || (!status.startsWith("5") && outcome !== "unexpected_error")) {
        successful += count;
      } else {
        failed += count;
      }
    } else if (name === "chain_dead_letters_total") {
      deadLetters += count;
    }
  }

  const denominator = successful + failed + deadLetters;
  const numerator = successful;
  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.999;
  return {
    name: "Chain Queue SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Storage Availability SLI.
 * Numerator: Count of non-5xx storage operations across all storage backends.
 * Denominator: Total count of storage read/write operations.
 */
export function computeStorageAvailabilitySLI(
  options?: ComputeSLOOptions,
  snap = snapshot(),
): SLIResult {
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "storage_operations_total") continue;

    denominator += count;
    const status = labels.status ?? "200";
    if (!status.startsWith("5") && status !== "error") {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.9999;
  return {
    name: "Storage Availability SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Account Provisioning SLI.
 * Numerator: Count of successful account creation, wallet linking, and username reservation steps.
 * Denominator: Total count of provisioning step executions.
 */
export function computeProvisioningSLI(options?: ComputeSLOOptions, snap = snapshot()): SLIResult {
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "provisioning_operations_total") continue;

    denominator += count;
    const status = labels.status ?? "200";
    const outcome = labels.outcome ?? "success";
    if (!status.startsWith("5") && outcome !== "unexpected_error") {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.99;
  return {
    name: "Account Provisioning SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

/**
 * Computes Mailbox & Message Sync Availability SLI.
 * Numerator: Count of non-5xx sync requests processed.
 * Denominator: Total count of sync requests processed.
 */
export function computeSyncAvailabilitySLI(
  options?: ComputeSLOOptions,
  snap = snapshot(),
): SLIResult {
  let numerator = 0;
  let denominator = 0;

  for (const [key, count] of Object.entries(snap.counters)) {
    const { name, labels } = parseKey(key);
    if (name !== "sync_operations_total") continue;

    denominator += count;
    const status = labels.status ?? "200";
    if (!status.startsWith("5")) {
      numerator += count;
    }
  }

  const ratio = denominator === 0 ? 1.0 : numerator / denominator;
  const target = 0.999;
  return {
    name: "Sync Availability SLI",
    numerator,
    denominator,
    ratio,
    target,
    met: ratio >= target,
  };
}

export interface SLOSummary {
  availability: SLIResult;
  latency: SLIResult;
  authAvailability: SLIResult;
  postageTransitions: SLIResult;
  relayDelivery: SLIResult;
  chainQueue: SLIResult;
  storageAvailability: SLIResult;
  provisioning: SLIResult;
  syncAvailability: SLIResult;
  allMet: boolean;
}

/**
 * Computes a summary of all API Service-Level Indicators across core and beta workflows.
 */
export function computeSLOSummary(options?: ComputeSLOOptions): SLOSummary {
  const snap = snapshot();
  const availability = computeAvailabilitySLI(options, snap);
  const latency = computeLatencySLI(250, options, snap);
  const authAvailability = computeAuthAvailabilitySLI(options, snap);
  const postageTransitions = computePostageTransitionSLI(options, snap);
  const relayDelivery = computeRelayDeliverySLI(options, snap);
  const chainQueue = computeChainQueueSLI(options, snap);
  const storageAvailability = computeStorageAvailabilitySLI(options, snap);
  const provisioning = computeProvisioningSLI(options, snap);
  const syncAvailability = computeSyncAvailabilitySLI(options, snap);

  const allMet =
    availability.met &&
    latency.met &&
    authAvailability.met &&
    postageTransitions.met &&
    relayDelivery.met &&
    chainQueue.met &&
    storageAvailability.met &&
    provisioning.met &&
    syncAvailability.met;

  return {
    availability,
    latency,
    authAvailability,
    postageTransitions,
    relayDelivery,
    chainQueue,
    storageAvailability,
    provisioning,
    syncAvailability,
    allMet,
  };
}
