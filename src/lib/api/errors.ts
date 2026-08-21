// ---------------------------------------------------------------------------
// BETA-051 (Issue #1958) — normalized public API errors for the web client.
//
// The server returns a single error envelope `{ error, meta }` with a stable
// `code`, a machine `retryClassification`, and an optional `retryAfter`. Every
// client code path throws `ApiClientError` so UI surfaces can render one
// consistent vocabulary (unauthorized, rate-limited, offline, timeout, etc.)
// regardless of which typed client produced the failure.
// ---------------------------------------------------------------------------

export const API_CLIENT_ERROR_CODES = [
  "unauthorized",
  "session_expired",
  "forbidden",
  "not_found",
  "validation_error",
  "conflict",
  "rate_limited",
  "dependency_failure",
  "payload_too_large",
  "invalid_state_transition",
  "bad_request",
  "internal_error",
  "offline",
  "timeout",
] as const;

export type ApiClientErrorCode = (typeof API_CLIENT_ERROR_CODES)[number];

/**
 * Retry classification mirrors `src/server/api/errors.ts` so the client can
 * decide whether a failed mutation is safe to replay.
 */
export type ApiRetryClassification = "none" | "transient" | "rate_limited" | "idempotent_only";

export interface ApiClientErrorInit {
  code: ApiClientErrorCode | string;
  message: string;
  status: number;
  retryable: boolean;
  retryClassification: ApiRetryClassification;
  retryAfterSeconds?: number;
  details?: unknown;
  requestId?: string;
}

export class ApiClientError extends Error {
  readonly name = "ApiClientError" as const;
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryClassification: ApiRetryClassification;
  readonly retryAfterSeconds?: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(init: ApiClientErrorInit) {
    super(init.message);
    this.code = init.code;
    this.status = init.status;
    this.retryable = init.retryable;
    this.retryClassification = init.retryClassification;
    this.retryAfterSeconds = init.retryAfterSeconds;
    this.details = init.details;
    this.requestId = init.requestId;
  }

  get isUnauthorized(): boolean {
    return this.code === "unauthorized" || this.code === "session_expired";
  }

  get isRetryable(): boolean {
    return this.retryable;
  }
}

export function isApiClientError(value: unknown): value is ApiClientError {
  return value instanceof ApiClientError;
}

/** Maps an HTTP status to the canonical public code used across the UI. */
export function statusToCode(status: number): ApiClientErrorCode {
  switch (status) {
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 422:
      return "validation_error";
    case 429:
      return "rate_limited";
    case 413:
      return "payload_too_large";
    case 503:
      return "dependency_failure";
    case 400:
      return "bad_request";
    case 500:
      return "internal_error";
    default:
      return "internal_error";
  }
}

/** Normalize any thrown value into an `ApiClientError` for UI consumption. */
export function normalizeApiClientError(caught: unknown): ApiClientError {
  if (isApiClientError(caught)) return caught;

  if (caught instanceof DOMException && caught.name === "AbortError") {
    const timedOut = caught.message.toLowerCase().includes("timeout");
    return new ApiClientError({
      code: timedOut ? "timeout" : "internal_error",
      message: timedOut ? "Request timed out" : "Request was cancelled",
      status: 0,
      retryable: timedOut,
      retryClassification: timedOut ? "transient" : "none",
    });
  }

  if (caught instanceof TypeError && /fetch|network/i.test(caught.message)) {
    return new ApiClientError({
      code: "offline",
      message: "You appear to be offline. Check your connection and retry.",
      status: 0,
      retryable: true,
      retryClassification: "transient",
    });
  }

  return new ApiClientError({
    code: "internal_error",
    message: caught instanceof Error ? caught.message : "An unexpected error occurred",
    status: 0,
    retryable: false,
    retryClassification: "none",
  });
}

/** Parse a server error envelope into a normalized client error. */
export function parseErrorEnvelope(body: unknown, fallbackStatus: number): ApiClientError {
  if (body !== null && typeof body === "object" && "error" in body) {
    const err = (body as { error: Record<string, unknown> }).error;
    const code = typeof err.code === "string" && err.code ? err.code : statusToCode(fallbackStatus);
    const message = typeof err.message === "string" && err.message ? err.message : "Request failed";
    const retryable = err.retryable === true;
    const retryClassification =
      typeof err.retryClassification === "string"
        ? (err.retryClassification as ApiRetryClassification)
        : retryable
          ? "transient"
          : "none";
    const retryAfterSeconds =
      typeof err.retryAfter === "number" && err.retryAfter > 0 ? err.retryAfter : undefined;
    const details = err.details;
    const requestId =
      body !== null && typeof body === "object" && "meta" in body
        ? ((body as { meta: { requestId?: unknown } }).meta.requestId as string | undefined)
        : undefined;
    return new ApiClientError({
      code,
      message,
      status: fallbackStatus,
      retryable,
      retryClassification,
      retryAfterSeconds,
      details,
      requestId,
    });
  }
  return new ApiClientError({
    code: statusToCode(fallbackStatus),
    message: `Request failed with HTTP ${fallbackStatus}`,
    status: fallbackStatus,
    retryable: false,
    retryClassification: "none",
  });
}

/** Stable human label for a normalized error, used by inline field/toast copy. */
export function errorLabel(error: ApiClientError): string {
  switch (error.code) {
    case "unauthorized":
    case "session_expired":
      return "Your session has expired. Sign in again to continue.";
    case "rate_limited":
      return error.retryAfterSeconds
        ? `Rate limit reached. Try again in ${error.retryAfterSeconds}s.`
        : "Rate limit reached. Try again shortly.";
    case "offline":
      return "You appear to be offline. Check your connection and retry.";
    case "timeout":
      return "The request timed out. Retry without sending the action again.";
    case "conflict":
      return "This change conflicted with a newer server state. Retry to reconcile.";
    case "dependency_failure":
      return "A required service is unavailable. Please retry.";
    case "validation_error":
      return "Please fix the highlighted fields and try again.";
    default:
      return error.message;
  }
}
