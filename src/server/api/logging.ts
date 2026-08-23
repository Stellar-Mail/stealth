export type ApiLogOutcome = "success" | "security_denied" | "unexpected_error";

export type ObservabilityStage =
  | "auth"
  | "provisioning"
  | "relay"
  | "storage"
  | "sync"
  | "chain_queue"
  | "delivery"
  | "api";

export type ObservabilityOutcome =
  | "success"
  | "security_denied"
  | "unexpected_error"
  | "rate_limited"
  | "transient_failure";

export interface ApiLogSamplingConfig {
  /** 1 logs every routine success; 0 suppresses every routine success log. */
  successSampleRate?: number;
}

export interface ApiLogContext {
  method?: string;
  requestId: string;
  route: string;
  status: number;
  outcome: ApiLogOutcome;
}

export interface ApiLogMetric {
  metric: "api.requests_total";
  route: string;
  status: number;
  outcome: ApiLogOutcome;
}

export interface ApiLogRecord extends ApiLogContext {
  sampled: boolean;
  samplingRate: number;
}

export interface ApiLogDecision {
  metrics: ApiLogMetric[];
  log?: ApiLogRecord;
}

export const ALLOWED_LOG_FIELDS = [
  "stage",
  "operation",
  "status",
  "outcome",
  "requestId",
  "supportId",
  "correlationId",
  "traceId",
  "spanId",
  "latencyMs",
  "durationMs",
  "errorCode",
  "errorType",
  "retryable",
  "retryClassification",
  "attempt",
  "queueName",
  "safeTargetReference",
  "policy",
  "reason",
  "sampled",
  "samplingRate",
  "method",
  "route",
  "timestamp",
] as const;

export type AllowedLogField = (typeof ALLOWED_LOG_FIELDS)[number];

export interface PrivacySafeLogEvent {
  stage: ObservabilityStage;
  operation: string;
  status: number;
  outcome: ApiLogOutcome | ObservabilityOutcome;
  requestId: string;
  supportId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  latencyMs?: number;
  durationMs?: number;
  errorCode?: string;
  errorType?: string;
  retryable?: boolean;
  retryClassification?: string;
  attempt?: number;
  queueName?: string;
  safeTargetReference?: string;
  policy?: string;
  reason?: string;
  route?: string;
  method?: string;
}

export interface PrivacySafeLogRecord extends PrivacySafeLogEvent {
  sampled: boolean;
  samplingRate: number;
  timestamp: string;
}

const DEFAULT_SUCCESS_SAMPLE_RATE = 0.1;
const HASH_BUCKETS = 10_000;

function clampRate(rate: number) {
  if (!Number.isFinite(rate)) return DEFAULT_SUCCESS_SAMPLE_RATE;
  return Math.min(1, Math.max(0, rate));
}

function hashToBucket(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % HASH_BUCKETS;
}

/**
 * Generates or derives a compact, browser-safe support identifier (e.g. sup_a1b2c3d4e5f6).
 * Support IDs allow users to reference issues in support tickets without revealing
 * their account address, email, or message content.
 */
export function generateSupportId(seed?: string): string {
  if (seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const hex = (hash >>> 0).toString(16).padStart(8, "0");
    return `sup_${hex}`;
  }
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return `sup_${Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function deriveSupportId(requestId: string): string {
  return generateSupportId(requestId);
}

/**
 * Redacts sensitive tokens, private keys, secret keys, seeds, passwords, and authorization headers.
 */
export function redactSensitiveString(str: string): string {
  if (!str) return str;
  return str
    .replace(/S[A-Z2-7]{55}/g, "[REDACTED_SEED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/(?:private|secret)[_-\s]?key["':\s]+[a-f0-9]{64}/gi, "[REDACTED_KEY]")
    .replace(/(?:password|passwd|pwd)["':\s]+[^"\s,]+/gi, "password:[REDACTED_PASSWORD]")
    .replace(
      /-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs,
      "[REDACTED_PRIVATE_KEY]",
    )
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
}

/**
 * Enforces field allowlists and sanitizes string fields against data leaks.
 */
export function sanitizeLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_LOG_FIELDS.includes(key as AllowedLogField)) {
      continue;
    }
    if (typeof value === "string") {
      clean[key] = redactSensitiveString(value);
    } else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null ||
      value === undefined
    ) {
      clean[key] = value;
    }
  }
  return clean;
}

export function shouldSampleRoutineSuccess(
  route: string,
  requestId: string,
  config: ApiLogSamplingConfig = {},
) {
  const rate = clampRate(config.successSampleRate ?? DEFAULT_SUCCESS_SAMPLE_RATE);
  if (rate >= 1) return true;
  if (rate <= 0) return false;

  return hashToBucket(`${route}:${requestId}`) < Math.floor(rate * HASH_BUCKETS);
}

export function planApiLog(
  context: ApiLogContext,
  config: ApiLogSamplingConfig = {},
): ApiLogDecision {
  const metrics: ApiLogMetric[] = [
    {
      metric: "api.requests_total",
      route: context.route,
      status: context.status,
      outcome: context.outcome,
    },
  ];

  const samplingRate =
    context.outcome === "success"
      ? clampRate(config.successSampleRate ?? DEFAULT_SUCCESS_SAMPLE_RATE)
      : 1;
  const sampled =
    context.outcome === "success"
      ? shouldSampleRoutineSuccess(context.route, context.requestId, {
          successSampleRate: samplingRate,
        })
      : true;

  return {
    metrics,
    ...(sampled ? { log: { ...context, sampled, samplingRate } } : {}),
  };
}

/**
 * Plans a structured, privacy-safe log across any stage with guaranteed capture of
 * errors and security denials, deterministic sampling for routine successes, and
 * automatic field allowlist filtering.
 */
export function planPrivacySafeLog(
  event: PrivacySafeLogEvent,
  config: ApiLogSamplingConfig = {},
): { log?: PrivacySafeLogRecord; metrics: ApiLogMetric[] } {
  const isRoutineSuccess = event.outcome === "success";
  const samplingRate = isRoutineSuccess
    ? clampRate(config.successSampleRate ?? DEFAULT_SUCCESS_SAMPLE_RATE)
    : 1.0;

  const sampleKey = event.route ?? `${event.stage}:${event.operation}`;
  const sampled = isRoutineSuccess
    ? shouldSampleRoutineSuccess(sampleKey, event.requestId, {
        successSampleRate: samplingRate,
      })
    : true;

  const supportId = event.supportId ?? deriveSupportId(event.requestId);

  const mappedOutcome: ApiLogOutcome =
    event.outcome === "security_denied"
      ? "security_denied"
      : event.outcome === "unexpected_error"
        ? "unexpected_error"
        : "success";

  const metrics: ApiLogMetric[] = [
    {
      metric: "api.requests_total",
      route: event.route ?? `/${event.stage}/${event.operation}`,
      status: event.status,
      outcome: mappedOutcome,
    },
  ];

  if (!sampled) {
    return { metrics };
  }

  const rawRecord = {
    ...event,
    supportId,
    sampled,
    samplingRate,
    timestamp: new Date().toISOString(),
  };

  const sanitized = sanitizeLogPayload(rawRecord) as unknown as PrivacySafeLogRecord;

  return {
    metrics,
    log: sanitized,
  };
}
