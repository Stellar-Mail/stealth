/**
 * PDF Summary Tool — Execution Fixtures
 *
 * Typed input/expectedOutput pairs for success and failure scenarios.
 * Used by tests and as living documentation of the execution contract.
 *
 * Pattern follows customer-support-macro-tool/fixtures/macros.fixture.ts
 * (typed TS objects, not raw JSON).
 */

import type {
  FixtureExecutionInput,
  FixtureExecutionOutput,
} from "./execution.types";
import { FixtureAction, FixtureErrorCode } from "./execution.types";
import type { SummarySettings } from "../types";

// ---------------------------------------------------------------------------
// Shared constants used across fixtures
// ---------------------------------------------------------------------------

const SHORT_BULLET_SETTINGS: SummarySettings = {
  length: "short",
  style: "bullet-points",
  includeKeywords: true,
  language: "en",
};

const DEFAULT_SETTINGS: SummarySettings = {
  length: "medium",
  style: "paragraph",
  includeKeywords: false,
  language: "en",
};

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Fixture shape
// ---------------------------------------------------------------------------

export interface ExecutionFixture {
  /** Human-readable label for test runners. */
  label: string;
  input: FixtureExecutionInput;
  expectedOutput: Pick<FixtureExecutionOutput, "success"> & {
    /** Partial match — tests can use `expect.objectContaining`. */
    error?: { code: FixtureErrorCode };
    /** When present, tests assert that data is defined. */
    hasData?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Success cases
// ---------------------------------------------------------------------------

export const SUCCESS_FIXTURES: ExecutionFixture[] = [
  {
    label: "GENERATE_SUMMARY with valid text and short/bullet-points settings",
    input: {
      action: FixtureAction.GENERATE_SUMMARY,
      payload: {
        text: "Artificial intelligence has transformed how we process documents in the modern workplace.",
        settings: SHORT_BULLET_SETTINGS,
      },
    },
    expectedOutput: { success: true, hasData: true },
  },
  {
    label: "VALIDATE_PDF with a small valid PDF",
    input: {
      action: FixtureAction.VALIDATE_PDF,
      payload: {
        fileName: "report.pdf",
        fileSizeBytes: 1_024_000, // ~1 MB
        mimeType: "application/pdf",
      },
    },
    expectedOutput: { success: true, hasData: true },
  },
  {
    label: "GET_SETTINGS returns defaults",
    input: {
      action: FixtureAction.GET_SETTINGS,
    },
    expectedOutput: { success: true, hasData: true },
  },
];

// ---------------------------------------------------------------------------
// Failure cases
// ---------------------------------------------------------------------------

export const FAILURE_FIXTURES: ExecutionFixture[] = [
  {
    label: "GENERATE_SUMMARY with missing payload",
    input: {
      action: FixtureAction.GENERATE_SUMMARY,
      payload: undefined as unknown as { text: string; settings: SummarySettings },
    },
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.INVALID_INPUT },
    },
  },
  {
    label: "GENERATE_SUMMARY with empty text",
    input: {
      action: FixtureAction.GENERATE_SUMMARY,
      payload: {
        text: "   ",
        settings: DEFAULT_SETTINGS,
      },
    },
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.EXTRACTION_FAILED },
    },
  },
  {
    label: "VALIDATE_PDF with oversized file (exceeds 50 MB)",
    input: {
      action: FixtureAction.VALIDATE_PDF,
      payload: {
        fileName: "huge-scan.pdf",
        fileSizeBytes: MAX_FILE_SIZE_BYTES + 1,
        mimeType: "application/pdf",
      },
    },
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.FILE_TOO_LARGE },
    },
  },
  {
    label: "VALIDATE_PDF with wrong MIME type",
    input: {
      action: FixtureAction.VALIDATE_PDF,
      payload: {
        fileName: "document.docx",
        fileSizeBytes: 50_000,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    },
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.UNSUPPORTED_FORMAT },
    },
  },
  {
    label: "Unknown action returns ACTION_NOT_SUPPORTED",
    input: {
      action: "TELEPORT_PDF" as FixtureAction,
      payload: {},
    },
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.ACTION_NOT_SUPPORTED },
    },
  },
  {
    label: "Null input returns INVALID_INPUT",
    input: null as unknown as FixtureExecutionInput,
    expectedOutput: {
      success: false,
      error: { code: FixtureErrorCode.INVALID_INPUT },
    },
  },
];
