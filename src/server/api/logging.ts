import { ApiError } from "./errors";
import { ZodError } from "zod";

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

const SENSITIVE_PATTERNS = [
  /auth/i,
  /sig/i,
  /nonce/i,
  /cookie/i,
  /token/i,
  /key/i,
  /password/i,
  /secret/i,
  /body/i,
];

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

export function redact(value: any, seen = new WeakSet()): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof RegExp) {
    return value.toString();
  }

  if (typeof Headers !== "undefined" && value instanceof Headers) {
    const result: Record<string, string> = {};
    value.forEach((val, key) => {
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = val;
      }
    });
    return result;
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);
    try {
      return value.map((item) => redact(item, seen));
    } finally {
      seen.delete(value);
    }
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  try {
    const result: Record<string, any> = {};

    if (typeof value.forEach === "function" && typeof value.entries === "function") {
      value.forEach((val: any, key: string) => {
        if (isSensitiveKey(key)) {
          result[key] = "[REDACTED]";
        } else {
          result[key] = redact(val, seen);
        }
      });
      return result;
    }

    for (const key of Object.keys(value)) {
      if (isSensitiveKey(key)) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = redact(value[key], seen);
      }
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function classifyError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code;
  }
  if (error instanceof ZodError) {
    return "validation_error";
  }
  if (error instanceof Error) {
    return "internal_error";
  }
  return "unknown_error";
}

export interface StructuredLogInput {
  routeId?: string;
  route?: string;
  requestId: string;
  status: number;
  durationMs: number;
  error?: unknown;
  method?: string;
  [key: string]: any;
}

export class StructuredLogger {
  private safeKeys = new Set([
    "routeId",
    "route",
    "requestId",
    "status",
    "durationMs",
    "errorClass",
    "outcome",
    "method",
    "level",
    "timestamp",
  ]);

  log(input: StructuredLogInput): void {
    try {
      const routeId = input.routeId || input.route || "unknown";
      const logRecord: Record<string, any> = {
        timestamp: new Date().toISOString(),
        level: input.status >= 500 ? "error" : input.status >= 400 ? "warn" : "info",
        routeId,
        requestId: input.requestId,
        status: input.status,
        durationMs: input.durationMs,
      };

      if (input.method) {
        logRecord.method = input.method;
      }

      if (input.error !== undefined) {
        logRecord.errorClass = classifyError(input.error);
      }

      const redactedMeta: Record<string, any> = {};
      for (const [key, val] of Object.entries(input)) {
        if (this.safeKeys.has(key)) {
          continue;
        }
        if (key === "error") {
          continue;
        }
        redactedMeta[key] = redact(val);
      }

      if (Object.keys(redactedMeta).length > 0) {
        logRecord.metadata = redactedMeta;
      }

      console.log(JSON.stringify(logRecord));
    } catch (e) {
      // Logger failures do not fail API requests.
      try {
        console.error("Logger failed to log request safely", e);
      } catch {}
    }
  }
}

export const logger = new StructuredLogger();

