/**
 * PDF Summary Tool - Execution Contract Types
 *
 * Defines the typed input/output contract for non-UI, backend-facing
 * execution of the PDF Summary Tool. This contract is serializable
 * and independent of browser/React APIs.
 *
 * See MODULE_BOUNDARIES.md for type design guidelines.
 */

import type { SummarySettings } from "./index";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** All actions supported by the top-level execution contract. */
export enum ExecutionAction {
  /** Generate a summary from pre-extracted PDF text content. */
  SUMMARIZE_PDF = "SUMMARIZE_PDF",

  /** Validate a PDF file's metadata (name, size, MIME type). */
  VALIDATE_PDF = "VALIDATE_PDF",

  /** Retrieve a previously generated summary by ID. */
  GET_SUMMARY = "GET_SUMMARY",

  /** List all stored summaries. */
  LIST_SUMMARIES = "LIST_SUMMARIES",

  /** Delete a stored summary by ID. */
  DELETE_SUMMARY = "DELETE_SUMMARY",
}

// ---------------------------------------------------------------------------
// Per-action payloads
// ---------------------------------------------------------------------------

/**
 * Payload for SUMMARIZE_PDF.
 *
 * Accepts pre-extracted text — *not* a raw File object — so the contract
 * stays serializable and decoupled from the browser File API.
 */
export interface SummarizePdfPayload {
  /** Pre-extracted text content from the PDF. */
  pdfContent: string;

  /** Original filename of the PDF. */
  fileName: string;

  /** File size in bytes (used for metadata). */
  fileSizeBytes: number;

  /** Optional overrides; defaults are applied for any missing fields. */
  settings?: Partial<SummarySettings>;
}

/** Payload for VALIDATE_PDF. */
export interface ValidatePdfPayload {
  /** Original filename of the PDF. */
  fileName: string;

  /** File size in bytes. */
  fileSizeBytes: number;

  /** MIME type reported by the file / upload layer. */
  mimeType: string;
}

/** Payload for GET_SUMMARY. */
export interface GetSummaryPayload {
  /** ID of the summary to retrieve. */
  summaryId: string;
}

/** Payload for DELETE_SUMMARY. */
export interface DeleteSummaryPayload {
  /** ID of the summary to delete. */
  summaryId: string;
}

// ---------------------------------------------------------------------------
// Input / Output envelope
// ---------------------------------------------------------------------------

/**
 * Top-level execution input.
 *
 * `action` is typed as the union of `ExecutionAction` and `string` so the
 * service can gracefully reject unknown actions at runtime.
 */
export interface ExecutionInput {
  action: ExecutionAction | string;
  payload?: Record<string, any>;
}

/**
 * Top-level execution output.
 *
 * Exactly one of `data` or `error` will be present:
 * - `success: true`  → `data` is set
 * - `success: false` → `error` is set
 */
export interface ExecutionOutput<T = any> {
  success: boolean;
  data?: T;
  error?: ExecutionError;
}

/** Structured error returned on failure. */
export interface ExecutionError {
  code: ExecutionErrorCode;
  message: string;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Exhaustive set of error codes for the execution contract. */
export enum ExecutionErrorCode {
  /** A required field is missing or the action itself is absent. */
  INVALID_INPUT = "INVALID_INPUT",

  /** A field is present but its value is invalid. */
  VALIDATION_ERROR = "VALIDATION_ERROR",

  /** The requested summary does not exist in storage. */
  SUMMARY_NOT_FOUND = "SUMMARY_NOT_FOUND",

  /** The supplied pdfContent is too short to summarize. */
  CONTENT_TOO_SHORT = "CONTENT_TOO_SHORT",

  /** The file exceeds the maximum allowed size. */
  FILE_TOO_LARGE = "FILE_TOO_LARGE",

  /** The file's MIME type is not in the supported list. */
  UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE",

  /** The requested action string is not a known ExecutionAction. */
  ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED",

  /** An unexpected internal error occurred. */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
