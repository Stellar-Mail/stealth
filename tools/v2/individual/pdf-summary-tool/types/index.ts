/**
 * PDF Summary Tool - Type Definitions
 *
 * All TypeScript types and interfaces for the PDF Summary Tool.
 * See MODULE_BOUNDARIES.md for type design guidelines.
 */

/**
 * Represents a PDF file with metadata
 */
export interface PDF {
  /** Unique identifier (generated from file) */
  id: string;

  /** Original filename */
  name: string;

  /** File size in bytes */
  size: number;

  /** When the file was selected by user */
  uploadedAt: Date;

  /** Extracted text content (temporary, only during processing) */
  content?: string;
}

/**
 * Represents a generated summary
 */
export interface Summary {
  /** Unique identifier for this summary */
  id: string;

  /** Reference to the source PDF */
  pdfId: string;

  /** Summary text content */
  content: string;

  /** Settings used to generate this summary */
  settings: SummarySettings;

  /** When this summary was created */
  generatedAt: Date;
}

/**
 * Configuration for summary generation
 */
export interface SummarySettings {
  /** How long the summary should be */
  length: "short" | "medium" | "long";

  /** Output format for the summary */
  style: "bullet-points" | "paragraph";

  /** Whether to extract and include keywords */
  includeKeywords: boolean;

  /** Language code for processing (e.g., 'en', 'es', 'fr') */
  language: string;
}

/**
 * Result of file or content validation
 */
export interface ValidationResult {
  /** Whether the input is valid */
  isValid: boolean;

  /** Error message if validation failed */
  error?: string;
}

/**
 * Hook return type for PDF summarization
 */
export interface UsePDFSummaryReturn {
  /** Generated summary (null if not ready) */
  summary: Summary | null;

  /** Whether summarization is in progress */
  isLoading: boolean;

  /** Error message if summarization failed */
  error?: string;
}

/**
 * Hook return type for storage management
 */
export interface UseLocalSummaryStorageReturn {
  /** All stored summaries */
  summaries: Summary[];

  /** Function to persist a summary */
  saveSummary: (summary: Summary) => Promise<void>;

  /** Function to delete a summary */
  deleteSummary: (id: string) => Promise<void>;

  /** Whether storage operation is in progress */
  isLoading: boolean;

  /** Error message if storage operation failed */
  error?: string;
}

/**
 * Hook return type for settings management
 */
export interface UseSummarySettingsReturn {
  /** Current user settings */
  settings: SummarySettings;

  /** Function to update settings */
  updateSettings: (settings: SummarySettings) => void;

  /** Whether settings are loading */
  isLoading: boolean;

  /** Error message if settings operation failed */
  error?: string;
}

// Add more types as needed following this pattern

export * from "./execution";
