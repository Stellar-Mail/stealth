import { ZodError } from "zod";

export type ApiErrorCode =
  | "bad_request"
  | "conflict"
  | "forbidden"
  | "internal_error"
  | "method_not_allowed"
  | "not_found"
  | "unauthorized"
  | "validation_error"
  | "too_many_requests";

/**
 * Central error-code registry.
 *
 * Each entry maps a stable machine-readable code to its HTTP status, default
 * safe message, and retryability classification.  The registry is the
 * single source of truth for API error semantics and is exported as a JSON
 * catalogue during CI artifact generation so drift is detected early.
 */
export interface ErrorRegistryEntry {
  code: ApiErrorCode;
  status: number;
  message: string;
  retryable: boolean;
  docs?: string;
}

export const errorRegistry: Record<ApiErrorCode, ErrorRegistryEntry> = {
  bad_request: {
    code: "bad_request",
    status: 400,
    message: "The request body is malformed or missing required fields.",
    retryable: false,
  },
  conflict: {
    code: "conflict",
    status: 409,
    message: "The request conflicts with the current resource state.",
    retryable: false,
  },
  forbidden: {
    code: "forbidden",
    status: 403,
    message: "The authenticated principal is not authorized for this action.",
    retryable: false,
  },
  internal_error: {
    code: "internal_error",
    status: 500,
    message: "An unexpected server error occurred.",
    retryable: true,
  },
  method_not_allowed: {
    code: "method_not_allowed",
    status: 405,
    message: "The HTTP method is not supported for this resource.",
    retryable: false,
  },
  not_found: {
    code: "not_found",
    status: 404,
    message: "The requested resource does not exist.",
    retryable: false,
  },
  unauthorized: {
    code: "unauthorized",
    status: 401,
    message: "Valid authentication credentials are required.",
    retryable: false,
  },
  validation_error: {
    code: "validation_error",
    status: 422,
    message: "Request validation failed.",
    retryable: false,
  },
  too_many_requests: {
    code: "too_many_requests",
    status: 429,
    message: "Rate limit exceeded; retry after the indicated delay.",
    retryable: true,
  },
} satisfies Record<ApiErrorCode, ErrorRegistryEntry>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly status: number;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return new ApiError(422, "validation_error", "Request validation failed", error.flatten());
  }

  return new ApiError(500, "internal_error", "An unexpected server error occurred");
}
