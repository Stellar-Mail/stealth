/**
 * Execution contract for PDF Summary Tool types.
 * Non-UI, backend-facing types for PDF summary execution.
 */

/** Error codes for PDF summary execution failures */
export type PdfSummaryErrorCode =
  | 'INVALID_INPUT'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'TEXT_EXTRACTION_FAILED'
  | 'SUMMARIZATION_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'INTERNAL_ERROR';

/** Input for PDF summary execution */
export interface PdfSummaryInput {
  /** PDF file buffer */
  fileBuffer: Buffer;
  /** Original filename */
  fileName: string;
  /** File size in bytes */
  fileSize: number;
  /** Summary generation settings */
  settings: PdfSummaryExecutionSettings;
}

/** Settings for summary generation */
export interface PdfSummaryExecutionSettings {
  /** How long the summary should be */
  length: 'short' | 'medium' | 'long';
  /** Output format */
  style: 'bullet-points' | 'paragraph';
  /** Whether to include keywords */
  includeKeywords: boolean;
  /** Language code */
  language: string;
}

/** Output from successful PDF summary execution */
export interface PdfSummaryOutput {
  /** Unique summary identifier */
  id: string;
  /** Reference to source PDF id */
  pdfId: string;
  /** Summary text content */
  content: string;
  /** Extracted keywords if requested */
  keywords?: string[];
  /** When summary was generated */
  generatedAt: string;
  /** Settings used */
  settings: PdfSummaryExecutionSettings;
}

/** Error result structure */
export interface PdfSummaryError {
  code: PdfSummaryErrorCode;
  message: string;
  /** Dot-path to invalid field when applicable */
  field?: string;
}

/** Discriminated union result type */
export type PdfSummaryResult =
  | { ok: true; data: PdfSummaryOutput }
  | { ok: false; error: PdfSummaryError };

/** Execution function type signature */
export type ExecutePdfSummary = (
  input: PdfSummaryInput,
) => Promise<PdfSummaryResult>;
