/**
 * PDF Summary Tool - Execution Contract Utilities
 *
 * Typed utilities for validating inputs and shaping outputs
 * according to the execution contract. Provides a stable interface
 * for backend-facing operations.
 *
 * No side effects, no async code, deterministic.
 */

import type {
  ExecutionInput,
  ExecutionOutput,
  ExecutionError,
  SummarizePdfPayload,
  ValidatePdfPayload,
  GetSummaryPayload,
  DeleteSummaryPayload,
} from "../types/execution";
import { ExecutionAction, ExecutionErrorCode } from "../types/execution";

// ---------------------------------------------------------------------------
// Input Validation
// ---------------------------------------------------------------------------

/**
 * Validate that the action is a known ExecutionAction.
 *
 * Returns true if `action` is a string that matches an ExecutionAction enum value.
 * Allows graceful rejection of unknown actions.
 */
export function isValidAction(action: string | undefined): action is ExecutionAction {
  if (!action || typeof action !== "string") {
    return false;
  }
  return Object.values(ExecutionAction).includes(action as ExecutionAction);
}

/**
 * Validate a SummarizePdfPayload structure.
 *
 * Returns an ExecutionError if validation fails, otherwise undefined.
 * Checks for required fields and field type constraints.
 */
export function validateSummarizePdfPayload(payload: unknown): ExecutionError | undefined {
  if (!payload || typeof payload !== "object") {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "Payload must be an object",
    };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.pdfContent !== "string" || p.pdfContent.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "pdfContent must be a non-empty string",
    };
  }

  if (typeof p.fileName !== "string" || p.fileName.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "fileName must be a non-empty string",
    };
  }

  if (typeof p.fileSizeBytes !== "number" || p.fileSizeBytes < 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "fileSizeBytes must be a non-negative number",
    };
  }

  return undefined;
}

/**
 * Validate a ValidatePdfPayload structure.
 *
 * Returns an ExecutionError if validation fails, otherwise undefined.
 */
export function validateValidatePdfPayload(payload: unknown): ExecutionError | undefined {
  if (!payload || typeof payload !== "object") {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "Payload must be an object",
    };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.fileName !== "string" || p.fileName.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "fileName must be a non-empty string",
    };
  }

  if (typeof p.fileSizeBytes !== "number" || p.fileSizeBytes < 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "fileSizeBytes must be a non-negative number",
    };
  }

  if (typeof p.mimeType !== "string" || p.mimeType.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "mimeType must be a non-empty string",
    };
  }

  return undefined;
}

/**
 * Validate a GetSummaryPayload structure.
 */
export function validateGetSummaryPayload(payload: unknown): ExecutionError | undefined {
  if (!payload || typeof payload !== "object") {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "Payload must be an object",
    };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.summaryId !== "string" || p.summaryId.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "summaryId must be a non-empty string",
    };
  }

  return undefined;
}

/**
 * Validate a DeleteSummaryPayload structure.
 */
export function validateDeleteSummaryPayload(payload: unknown): ExecutionError | undefined {
  if (!payload || typeof payload !== "object") {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "Payload must be an object",
    };
  }

  const p = payload as Record<string, unknown>;

  if (typeof p.summaryId !== "string" || p.summaryId.trim().length === 0) {
    return {
      code: ExecutionErrorCode.INVALID_INPUT,
      message: "summaryId must be a non-empty string",
    };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Output Shaping
// ---------------------------------------------------------------------------

/**
 * Create a successful execution output.
 *
 * Ensures the output has `success: true` and data is present.
 */
export function createSuccessOutput<T = any>(data: T): ExecutionOutput<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Create a failure execution output.
 *
 * Ensures the output has `success: false` and error is present.
 */
export function createErrorOutput(code: ExecutionErrorCode, message: string): ExecutionOutput {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

// ---------------------------------------------------------------------------
// Type Guards
// ---------------------------------------------------------------------------

/**
 * Narrow an ExecutionOutput to success case.
 *
 * Useful for type-safe handling of successful responses.
 */
export function isSuccessOutput(output: ExecutionOutput): output is ExecutionOutput & {
  success: true;
  data: any;
  error: undefined;
} {
  return output.success === true && output.data !== undefined;
}

/**
 * Narrow an ExecutionOutput to error case.
 *
 * Useful for type-safe handling of error responses.
 */
export function isErrorOutput(output: ExecutionOutput): output is ExecutionOutput & {
  success: false;
  error: ExecutionError;
  data: undefined;
} {
  return output.success === false && output.error !== undefined;
}

// ---------------------------------------------------------------------------
// Payload Casting
// ---------------------------------------------------------------------------

/**
 * Cast a payload to the expected type after validation.
 *
 * Usage: after validateSummarizePdfPayload returns undefined (success),
 * cast the payload to get typed access.
 */
export function castSummarizePdfPayload(payload: unknown): SummarizePdfPayload {
  return payload as SummarizePdfPayload;
}

export function castValidatePdfPayload(payload: unknown): ValidatePdfPayload {
  return payload as ValidatePdfPayload;
}

export function castGetSummaryPayload(payload: unknown): GetSummaryPayload {
  return payload as GetSummaryPayload;
}

export function castDeleteSummaryPayload(payload: unknown): DeleteSummaryPayload {
  return payload as DeleteSummaryPayload;
}
