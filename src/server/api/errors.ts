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
