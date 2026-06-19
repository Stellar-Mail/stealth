/**
 * Attachment Extractor - Type Definitions
 * Isolated tool for extracting and managing message attachments
 */

/** Supported file types for extraction */
export type FileCategory = "image" | "document" | "archive" | "video" | "audio" | "other";

/** Represents a single attachment */
export type Attachment = {
  id: string; // Unique identifier
  name: string; // Original filename
  mimeType: string; // MIME type (e.g., "image/jpeg")
  size: number; // File size in bytes
  category: FileCategory; // Categorized type
  extractedAt: Date; // Extraction timestamp
  checksum?: string; // Optional hash for integrity
  metadata?: AttachmentMetadata;
};

/** Additional metadata about attachment */
export type AttachmentMetadata = {
  width?: number; // Image width in pixels
  height?: number; // Image height in pixels
  duration?: number; // Audio/video duration in seconds
  pages?: number; // Document page count
  createdDate?: Date; // File creation date
  modifiedDate?: Date; // Last modified date
};

/** Extraction request options */
export type ExtractionOptions = {
  maxFileSize?: number; // Max file size in bytes (default: 50MB)
  allowedMimeTypes?: string[]; // Whitelist of MIME types
  extractMetadata?: boolean; // Whether to extract metadata
  generateChecksum?: boolean; // Whether to generate file hash
  categoryMapping?: Record<string, FileCategory>; // Custom MIME → category mapping
};

/** Result of extraction operation */
export type ExtractionResult = {
  success: boolean;
  attachments: Attachment[];
  errors: ExtractionError[];
  stats: ExtractionStats;
};

/** Error that occurred during extraction */
export type ExtractionError = {
  filename: string;
  mimeType?: string;
  reason: "unsupported_type" | "file_too_large" | "invalid_data" | "unknown";
  message: string;
};

/** Statistics about extraction operation */
export type ExtractionStats = {
  totalProcessed: number;
  successfulExtractions: number;
  failedExtractions: number;
  totalSize: number; // Combined size of extracted files
  byCategory: Record<FileCategory, number>; // Count by category
};

/** Loading state for async operations */
export type LoadingState = "idle" | "loading" | "success" | "error";

/** State management for extraction UI */
export type ExtractionState = {
  files: Attachment[];
  loadingState: LoadingState;
  error: string | null;
  selectedIds: Set<string>;
  stats: ExtractionStats;
};

/** Hook return type for extraction operations */
export type UseExtractorReturn = {
  state: ExtractionState;
  extract: (files: File[], options?: ExtractionOptions) => Promise<ExtractionResult>;
  selectAttachment: (id: string) => void;
  deselectAttachment: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  removeAttachment: (id: string) => void;
  clearAll: () => void;
  downloadAttachment: (id: string) => void;
  downloadSelected: () => void;
  reset: () => void;
};

/** Configuration for attachment extractor */
export type ExtractorConfig = {
  maxFileSize: number; // Max file size in bytes
  allowedMimeTypes: string[]; // Supported MIME types
  extractMetadata: boolean;
  generateChecksum: boolean;
  categoryMapping: Record<string, FileCategory>;
};
