import { ZodError, type ZodIssue } from "zod";

export interface ApiErrorDefinition {
  readonly status: number;
  readonly message: string;
  readonly retryable: boolean;
  readonly description: string;
}

/** The single source of truth for stable, public API error codes. */
export const API_ERROR_REGISTRY = {
  bad_request: {
    status: 400,
    message: "The request is invalid",
    retryable: false,
    description: "The request could not be parsed or is malformed.",
  },
  conflict: {
    status: 409,
    message: "The request conflicts with the current resource state",
    retryable: true,
    description: "A non-domain-specific resource conflict occurred.",
  },
  forbidden: {
    status: 403,
    message: "The requested operation is not permitted",
    retryable: false,
    description: "The authenticated actor is not permitted to perform the operation.",
  },
  internal_error: {
    status: 500,
    message: "An unexpected server error occurred",
    retryable: true,
    description: "The server encountered an unexpected condition.",
  },
  method_not_allowed: {
    status: 405,
    message: "The method is not allowed for this resource",
    retryable: false,
    description: "The resource does not support the requested HTTP method.",
  },
  not_found: {
    status: 404,
    message: "The requested resource was not found",
    retryable: false,
    description: "The requested resource does not exist or is not visible to the actor.",
  },
  unauthorized: {
    status: 401,
    message: "Authentication is required",
    retryable: false,
    description: "Valid authentication credentials were not provided.",
  },
  validation_error: {
    status: 422,
    message: "Request validation failed",
    retryable: false,
    description: "One or more request fields failed validation.",
  },
  too_many_requests: {
    status: 429,
    message: "Too many requests",
    retryable: true,
    description: "A request rate limit was exceeded.",
  },
  dependency_unavailable: {
    status: 503,
    message: "A required dependency is unavailable",
    retryable: true,
    description:
      "The server cannot handle the request because a required dependency is unavailable.",
  },
  data_integrity_error: {
    status: 500,
    message: "Stored data failed integrity validation",
    retryable: true,
    description: "Stored data did not satisfy the server's integrity checks.",
  },
  expired_challenge: {
    status: 422,
    message: "The challenge has expired",
    retryable: false,
    description: "The submitted authentication or quote challenge is no longer valid.",
  },
  challenge_not_yet_valid: {
    status: 422,
    message: "The challenge is not yet valid",
    retryable: false,
    description: "The submitted authentication challenge is dated too far in the future.",
  },
  idempotency_mismatch: {
    status: 409,
    message: "The idempotency key was already used for a different request",
    retryable: false,
    description: "An idempotency key was reused with a different request payload.",
  },
  invalid_state_transition: {
    status: 409,
    message: "The requested state transition is invalid",
    retryable: false,
    description: "The resource cannot transition from its current state as requested.",
  },
  insufficient_postage: {
    status: 422,
    message: "The postage amount is below the required minimum",
    retryable: false,
    description: "The supplied postage does not meet the recipient mailbox minimum.",
  },
  duplicate_receipt: {
    status: 409,
    message: "A receipt already exists for this message",
    retryable: false,
    description: "A delivery receipt has already been recorded for the message.",
  },
  duplicate_postage: {
    status: 409,
    message: "Postage already exists for this message",
    retryable: false,
    description: "A postage record has already been submitted for the message.",
  },
  invalid_quote: {
    status: 422,
    message: "The postage quote is invalid",
    retryable: false,
    description: "The supplied postage quote failed integrity validation.",
  },
  request_in_progress: {
    status: 409,
    message: "An equivalent request is already in progress",
    retryable: true,
    description: "A matching operation currently holds the idempotency lease.",
  },
} as const satisfies Record<string, ApiErrorDefinition>;

export type ApiErrorCode = keyof typeof API_ERROR_REGISTRY;

export const API_ERROR_CODES = Object.freeze(Object.keys(API_ERROR_REGISTRY) as ApiErrorCode[]);

export type ValidationRuleCode =
  | "invalid_type"
  | "format"
  | "min_length"
  | "max_length"
  | "minimum"
  | "maximum"
  | "missing"
  | "unknown_field"
  | "invalid_value";

export interface ValidationErrorItem {
  path: string;
  rule: ValidationRuleCode;
  message: string;
}

export interface ValidationErrorDetails {
  validationErrors: ValidationErrorItem[];
}

export type RetryClassification = "permanent" | "transient" | "rate_limit" | "conflict";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryClassification: RetryClassification;
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, details?: unknown);
  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown);
  constructor(
    statusOrCode: number | ApiErrorCode,
    codeOrDetails?: ApiErrorCode | unknown,
    legacyMessage?: string,
    legacyDetails?: unknown,
  ) {
    const code = typeof statusOrCode === "number" ? (codeOrDetails as ApiErrorCode) : statusOrCode;
    const definition = API_ERROR_REGISTRY[code];
    const details = typeof statusOrCode === "number" ? legacyDetails : codeOrDetails;
    super(legacyMessage ?? definition.message);
    this.name = "ApiError";
    this.status = typeof statusOrCode === "number" ? statusOrCode : definition.status;
    this.code = code;
    this.details = details;

    if (code === "too_many_requests") {
      this.retryClassification = "rate_limit";
      this.retryable = true;
      if (details && typeof details === "object" && "retryAfterSeconds" in details) {
        const val = (details as any).retryAfterSeconds;
        if (typeof val === "number") {
          this.retryAfterSeconds = val;
        }
      }
    } else if (code === "conflict" || code === "request_in_progress") {
      this.retryClassification = "conflict";
      this.retryable = true;
    } else if (code === "internal_error" || code === "data_integrity_error") {
      this.retryClassification = "transient";
      this.retryable = true;
    } else {
      this.retryClassification = "permanent";
      this.retryable = false;
    }
  }
}

export class DataIntegrityError extends Error {
  readonly recordType: string;
  readonly correlationId: string;
  readonly code: ApiErrorCode = "data_integrity_error";
  readonly status = 500;

  constructor(recordType: string, correlationId: string, message?: string) {
    super(message ?? `Stored ${recordType} record failed validation`);
    this.name = "DataIntegrityError";
    this.recordType = recordType;
    this.correlationId = correlationId;
  }
}

export class RetryExhaustedError extends Error {
  readonly code = "retry_exhausted" as const;
  readonly status = 500;
  readonly retryable = false;
  readonly retryClassification: RetryClassification = "transient";
  readonly originalError: unknown;

  constructor(originalError: unknown) {
    super("Operation failed after maximum retries");
    this.name = "RetryExhaustedError";
    this.originalError = originalError;
  }
}

function formatPath(path: ZodIssue["path"]) {
  if (path.length === 0) return "$";

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") return `${formatted}[${segment}]`;
    return formatted ? `${formatted}.${segment}` : segment;
  }, "");
}

function mapValidationRule(issue: ZodIssue): ValidationRuleCode {
  switch (issue.code) {
    case "invalid_type":
      return issue.received === "undefined" ? "missing" : "invalid_type";
    case "invalid_string":
      return "format";
    case "too_small":
      return issue.type === "string" || issue.type === "array" ? "min_length" : "minimum";
    case "too_big":
      return issue.type === "string" || issue.type === "array" ? "max_length" : "maximum";
    case "unrecognized_keys":
      return "unknown_field";
    default:
      return "invalid_value";
  }
}

export function normalizeValidationError(error: ZodError): ValidationErrorDetails {
  return {
    validationErrors: error.issues.map((issue) => ({
      path: formatPath(issue.path),
      rule: mapValidationRule(issue),
      message: issue.message,
    })),
  };
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return new ApiError(
      422,
      "validation_error",
      "Request validation failed",
      normalizeValidationError(error),
    );
  }

  return new ApiError(500, "internal_error", "An unexpected server error occurred");
}
