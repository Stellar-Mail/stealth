/**
 * PDF Summary Tool — Fixtures Execution Contract
 *
 * Typed inputs, outputs, and error codes for the non-UI service entry point.
 * Mirrors the contract pattern in config/types/execution.ts but covers the
 * tool-level PDF processing domain (summarisation, validation, settings).
 *
 * This file contains ONLY type definitions and enums — no runtime logic.
 */

import type { Summary, SummarySettings } from "../types";

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Actions the fixture execution service can handle. */
export enum FixtureAction {
  /** Generate a summary from extracted PDF text. */
  GENERATE_SUMMARY = "GENERATE_SUMMARY",
  /** Validate that a file meets PDF processing constraints. */
  VALIDATE_PDF = "VALIDATE_PDF",
  /** Retrieve the current default summary settings. */
  GET_SETTINGS = "GET_SETTINGS",
}

// ---------------------------------------------------------------------------
// Payloads (per-action)
// ---------------------------------------------------------------------------

/** Payload for {@link FixtureAction.GENERATE_SUMMARY}. */
export interface GenerateSummaryPayload {
  /** Pre-extracted text content from the PDF. */
  text: string;
  /** Settings that control summary length, style, etc. */
  settings: SummarySettings;
}

/** Payload for {@link FixtureAction.VALIDATE_PDF}. */
export interface ValidatePdfPayload {
  /** Original file name (used for format checks). */
  fileName: string;
  /** File size in bytes. */
  fileSizeBytes: number;
  /** MIME type reported by the browser File API. */
  mimeType: string;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/** Discriminated union of all valid execution inputs. */
export type FixtureExecutionInput =
  | { action: FixtureAction.GENERATE_SUMMARY; payload: GenerateSummaryPayload }
  | { action: FixtureAction.VALIDATE_PDF; payload: ValidatePdfPayload }
  | { action: FixtureAction.GET_SETTINGS; payload?: undefined }
  | { action: string; payload?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Structured error returned on failure. */
export interface FixtureExecutionError {
  code: FixtureErrorCode;
  message: string;
}

/** Result envelope returned by every execution call. */
export interface FixtureExecutionOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: FixtureExecutionError;
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

/** Exhaustive set of error codes the service may return. */
export enum FixtureErrorCode {
  /** The input object or required fields are missing / malformed. */
  INVALID_INPUT = "INVALID_INPUT",
  /** The file exceeds the maximum allowed size. */
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  /** The file MIME type is not in the supported list. */
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  /** Text extraction from the PDF failed. */
  EXTRACTION_FAILED = "EXTRACTION_FAILED",
  /** Summary generation failed. */
  SUMMARIZATION_FAILED = "SUMMARIZATION_FAILED",
  /** The requested action is not recognised. */
  ACTION_NOT_SUPPORTED = "ACTION_NOT_SUPPORTED",
  /** Catch-all for unexpected runtime errors. */
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

// ---------------------------------------------------------------------------
// Re-export domain types for consumer convenience
// ---------------------------------------------------------------------------

export type { Summary, SummarySettings };
