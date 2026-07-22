/**
 * PDF Summary Tool — Fixture Execution Service
 *
 * Non-UI service entry point for the fixtures module.
 * Provides a stable, backend-facing execution contract that can run
 * independently of any presentation layer.
 *
 * Mirrors the pattern in config/services/ExecutionService.ts.
 */

import type {
  FixtureExecutionInput,
  FixtureExecutionOutput,
  GenerateSummaryPayload,
  ValidatePdfPayload,
} from "./execution.types";
import {
  FixtureAction,
  FixtureErrorCode,
} from "./execution.types";
import type { Summary, SummarySettings } from "../types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const SUPPORTED_MIME_TYPES: ReadonlySet<string> = new Set(["application/pdf"]);

const DEFAULT_SETTINGS: SummarySettings = {
  length: "medium",
  style: "paragraph",
  includeKeywords: false,
  language: "en",
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Stateless execution service for the pdf-summary-tool fixtures module.
 *
 * Every public method returns a structured {@link FixtureExecutionOutput} and
 * **never throws** — all error paths are captured in the response envelope.
 */
export class FixtureExecutionService {
  /**
   * Single entry point for all fixture actions.
   *
   * @param input - Typed action + payload.
   * @returns A promise resolving to a structured output envelope.
   */
  public async execute(
    input: FixtureExecutionInput,
  ): Promise<FixtureExecutionOutput> {
    try {
      if (!input || !input.action) {
        return {
          success: false,
          error: {
            code: FixtureErrorCode.INVALID_INPUT,
            message: "Missing execution action",
          },
        };
      }

      switch (input.action) {
        case FixtureAction.GENERATE_SUMMARY:
          return this.handleGenerateSummary(
            input.payload as GenerateSummaryPayload | undefined,
          );
        case FixtureAction.VALIDATE_PDF:
          return this.handleValidatePdf(
            input.payload as ValidatePdfPayload | undefined,
          );
        case FixtureAction.GET_SETTINGS:
          return this.handleGetSettings();
        default:
          return {
            success: false,
            error: {
              code: FixtureErrorCode.ACTION_NOT_SUPPORTED,
              message: `Action "${input.action}" is not supported`,
            },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.INTERNAL_ERROR,
          message:
            error instanceof Error ? error.message : "Unknown internal error",
        },
      };
    }
  }

  // -----------------------------------------------------------------------
  // Action handlers
  // -----------------------------------------------------------------------

  private async handleGenerateSummary(
    payload: GenerateSummaryPayload | undefined,
  ): Promise<FixtureExecutionOutput<Summary>> {
    if (!payload || typeof payload.text !== "string" || !payload.settings) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.INVALID_INPUT,
          message:
            "payload.text (string) and payload.settings (SummarySettings) are required for GENERATE_SUMMARY",
        },
      };
    }

    if (payload.text.trim().length === 0) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.EXTRACTION_FAILED,
          message: "Cannot generate summary from empty text",
        },
      };
    }

    const summary: Summary = {
      id: `summary_${Date.now()}`,
      pdfId: "fixture-pdf",
      content: `Summary of: ${payload.text.slice(0, 80)}…`,
      settings: payload.settings,
      generatedAt: new Date(),
    };

    return { success: true, data: summary };
  }

  private async handleValidatePdf(
    payload: ValidatePdfPayload | undefined,
  ): Promise<FixtureExecutionOutput<{ valid: boolean }>> {
    if (
      !payload ||
      typeof payload.fileName !== "string" ||
      typeof payload.fileSizeBytes !== "number" ||
      typeof payload.mimeType !== "string"
    ) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.INVALID_INPUT,
          message:
            "payload.fileName, payload.fileSizeBytes, and payload.mimeType are required for VALIDATE_PDF",
        },
      };
    }

    if (payload.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.FILE_TOO_LARGE,
          message: `File size ${payload.fileSizeBytes} exceeds maximum of ${MAX_FILE_SIZE_BYTES} bytes`,
        },
      };
    }

    if (!SUPPORTED_MIME_TYPES.has(payload.mimeType)) {
      return {
        success: false,
        error: {
          code: FixtureErrorCode.UNSUPPORTED_FORMAT,
          message: `MIME type "${payload.mimeType}" is not supported. Expected one of: ${[...SUPPORTED_MIME_TYPES].join(", ")}`,
        },
      };
    }

    return { success: true, data: { valid: true } };
  }

  private async handleGetSettings(): Promise<
    FixtureExecutionOutput<SummarySettings>
  > {
    return { success: true, data: { ...DEFAULT_SETTINGS } };
  }
}
