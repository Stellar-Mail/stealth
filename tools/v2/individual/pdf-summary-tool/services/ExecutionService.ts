/**
 * PDF Summary Tool - Execution Service
 *
 * Non-UI service entry point for the PDF Summary Tool.
 * Provides a stable, backend-facing execution contract that can run
 * independently of React, the browser, or any UI layer.
 *
 * All actions are dispatched through the single `execute()` method.
 */

import type { Summary, SummarySettings } from "../types";
import {
  ExecutionAction,
  ExecutionErrorCode,
  type ExecutionInput,
  type ExecutionOutput,
  type SummarizePdfPayload,
  type ValidatePdfPayload,
  type GetSummaryPayload,
  type DeleteSummaryPayload,
} from "../types/execution";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum character count for text to be summarizable. */
const MIN_CONTENT_LENGTH = 50;

/** Maximum file size in bytes (50 MB). */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** MIME types accepted as valid PDFs. */
const SUPPORTED_MIME_TYPES = ["application/pdf"];

/** Default summary settings applied when the caller omits them. */
const DEFAULT_SETTINGS: SummarySettings = {
  length: "medium",
  style: "paragraph",
  includeKeywords: false,
  language: "en",
};

/** Target word counts per summary length tier. */
const LENGTH_WORD_TARGETS: Record<SummarySettings["length"], number> = {
  short: 60,
  medium: 150,
  long: 300,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ExecutionService {
  /** In-memory summary store. Keeps the service headless-compatible. */
  private summaries = new Map<string, Summary>();

  /**
   * Non-UI service entry point for pdf-summary-tool.
   * Provides a stable backend-facing execution contract.
   */
  public async execute(input: ExecutionInput): Promise<ExecutionOutput> {
    try {
      if (!input || !input.action) {
        return {
          success: false,
          error: {
            code: ExecutionErrorCode.INVALID_INPUT,
            message: "Missing execution action",
          },
        };
      }

      switch (input.action) {
        case ExecutionAction.SUMMARIZE_PDF:
          return this.handleSummarizePdf(input);
        case ExecutionAction.VALIDATE_PDF:
          return this.handleValidatePdf(input);
        case ExecutionAction.GET_SUMMARY:
          return this.handleGetSummary(input);
        case ExecutionAction.LIST_SUMMARIES:
          return this.handleListSummaries();
        case ExecutionAction.DELETE_SUMMARY:
          return this.handleDeleteSummary(input);
        default:
          return {
            success: false,
            error: {
              code: ExecutionErrorCode.ACTION_NOT_SUPPORTED,
              message: `Action ${input.action} is not supported`,
            },
          };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : "Unknown internal error",
        },
      };
    }
  }

  // -------------------------------------------------------------------------
  // Action handlers
  // -------------------------------------------------------------------------

  private async handleSummarizePdf(input: ExecutionInput): Promise<ExecutionOutput> {
    const payload = input.payload as SummarizePdfPayload | undefined;

    if (!payload?.pdfContent || !payload?.fileName) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "pdfContent and fileName are required for SUMMARIZE_PDF",
        },
      };
    }

    if (payload.pdfContent.trim().length < MIN_CONTENT_LENGTH) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.CONTENT_TOO_SHORT,
          message: `Content must be at least ${MIN_CONTENT_LENGTH} characters to summarize`,
        },
      };
    }

    const settings: SummarySettings = {
      ...DEFAULT_SETTINGS,
      ...(payload.settings ?? {}),
    };

    const summaryContent = this.generateSummaryText(payload.pdfContent, settings);

    const keywords = settings.includeKeywords
      ? this.extractKeywords(payload.pdfContent)
      : undefined;

    const summary: Summary = {
      id: this.generateSummaryId(payload.fileName),
      pdfId: payload.fileName,
      content: summaryContent,
      settings,
      generatedAt: new Date(),
    };

    // Persist to in-memory store
    this.summaries.set(summary.id, summary);

    return {
      success: true,
      data: {
        summary,
        ...(keywords ? { keywords } : {}),
      },
    };
  }

  private async handleValidatePdf(input: ExecutionInput): Promise<ExecutionOutput> {
    const payload = input.payload as ValidatePdfPayload | undefined;

    if (!payload?.fileName || payload?.fileSizeBytes == null || !payload?.mimeType) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "fileName, fileSizeBytes, and mimeType are required for VALIDATE_PDF",
        },
      };
    }

    if (payload.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.FILE_TOO_LARGE,
          message: `File size ${payload.fileSizeBytes} bytes exceeds maximum of ${MAX_FILE_SIZE_BYTES} bytes`,
        },
      };
    }

    if (!SUPPORTED_MIME_TYPES.includes(payload.mimeType)) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.UNSUPPORTED_FILE_TYPE,
          message: `MIME type "${payload.mimeType}" is not supported. Expected one of: ${SUPPORTED_MIME_TYPES.join(", ")}`,
        },
      };
    }

    return {
      success: true,
      data: {
        isValid: true,
        fileName: payload.fileName,
        fileSizeBytes: payload.fileSizeBytes,
        mimeType: payload.mimeType,
      },
    };
  }

  private async handleGetSummary(input: ExecutionInput): Promise<ExecutionOutput> {
    const payload = input.payload as GetSummaryPayload | undefined;

    if (!payload?.summaryId) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "summaryId is required for GET_SUMMARY",
        },
      };
    }

    const summary = this.summaries.get(payload.summaryId);
    if (!summary) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.SUMMARY_NOT_FOUND,
          message: `Summary with id "${payload.summaryId}" not found`,
        },
      };
    }

    return {
      success: true,
      data: { summary },
    };
  }

  private async handleListSummaries(): Promise<ExecutionOutput> {
    return {
      success: true,
      data: {
        summaries: Array.from(this.summaries.values()),
        count: this.summaries.size,
      },
    };
  }

  private async handleDeleteSummary(input: ExecutionInput): Promise<ExecutionOutput> {
    const payload = input.payload as DeleteSummaryPayload | undefined;

    if (!payload?.summaryId) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.INVALID_INPUT,
          message: "summaryId is required for DELETE_SUMMARY",
        },
      };
    }

    if (!this.summaries.has(payload.summaryId)) {
      return {
        success: false,
        error: {
          code: ExecutionErrorCode.SUMMARY_NOT_FOUND,
          message: `Summary with id "${payload.summaryId}" not found`,
        },
      };
    }

    this.summaries.delete(payload.summaryId);

    return {
      success: true,
      data: {
        deletedId: payload.summaryId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers (deterministic, pure-ish)
  // -------------------------------------------------------------------------

  /**
   * Generate a deterministic summary ID from the filename.
   * Uses a simple hash so the same file always gets the same ID.
   */
  private generateSummaryId(fileName: string): string {
    let hash = 0;
    for (let i = 0; i < fileName.length; i++) {
      const char = fileName.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return `summary-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Generate a deterministic summary from text content and settings.
   *
   * This is a text-truncation/extraction algorithm (no AI/ML), consistent
   * with the spec's constraint of "deterministic output for same input."
   */
  private generateSummaryText(content: string, settings: SummarySettings): string {
    const sentences = this.splitSentences(content);
    const targetWords = LENGTH_WORD_TARGETS[settings.length];

    // Select sentences until we reach the target word count
    const selected: string[] = [];
    let wordCount = 0;

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(Boolean);
      if (wordCount + words.length > targetWords && selected.length > 0) {
        break;
      }
      selected.push(sentence.trim());
      wordCount += words.length;
    }

    if (selected.length === 0 && sentences.length > 0) {
      selected.push(sentences[0].trim());
    }

    // Format according to style
    if (settings.style === "bullet-points") {
      return selected.map((s) => `• ${s}`).join("\n");
    }

    return selected.join(" ");
  }

  /**
   * Split text into sentence-like segments.
   * Handles common abbreviations to avoid false splits.
   */
  private splitSentences(text: string): string[] {
    return text
      .replace(/\n+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.trim().length > 0);
  }

  /**
   * Extract keywords using simple word-frequency analysis.
   * Returns the top 5 most frequent non-stopword tokens.
   */
  private extractKeywords(text: string, limit = 5): string[] {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "is",
      "it",
      "as",
      "be",
      "was",
      "were",
      "are",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "shall",
      "can",
      "not",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "its",
      "our",
      "their",
      "what",
      "which",
      "who",
      "whom",
      "how",
      "when",
      "where",
      "why",
      "all",
      "each",
      "every",
      "both",
      "few",
      "more",
      "most",
      "other",
      "some",
      "such",
      "no",
      "nor",
      "only",
      "own",
      "same",
      "so",
      "than",
      "too",
      "very",
      "just",
      "if",
      "then",
      "also",
      "about",
      "up",
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([word]) => word);
  }
}
