import { ZodError, type ZodIssue } from "zod";

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

/**
 * Machine‑readable error catalogue (excluding internal errors).
 */
export const errorCatalogue = [
  { code: "bad_request", status: 400, retryable: false, summary: "The request could not be understood or was missing required parameters." },
  { code: "conflict", status: 409, retryable: false, summary: "The request could not be completed due to a conflict with the current state of the resource." },
  { code: "forbidden", status: 403, retryable: false, summary: "The client does not have permission to perform the requested operation." },
  { code: "method_not_allowed", status: 405, retryable: false, summary: "The HTTP method is not supported for the requested resource." },
  { code: "not_found", status: 404, retryable: false, summary: "The requested resource could not be found." },
  { code: "unauthorized", status: 401, retryable: false, summary: "Authentication is required or has failed." },
  { code: "validation_error", status: 422, retryable: false, summary: "The request payload failed validation." },
  { code: "too_many_requests", status: 429, retryable: true, summary: "Rate limit exceeded; the client should retry after a back‑off period." },
] as const;

/**
 * Express handler exposing the error catalogue as JSON (versioned).
 */
export function getErrorCatalogue(req: Request, res: Response) {
  res.json({
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    errors: errorCatalogue,
  });
}
