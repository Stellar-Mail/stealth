export type ApiLogOutcome = "success" | "security_denied" | "unexpected_error";

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
