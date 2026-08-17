/**
 * Attachment Extractor - Local API Surface
 * Exports for folder-local consumption
 */

// Types
export type {
  Attachment,
  AttachmentMetadata,
  ExtractionError,
  ExtractionOptions,
  ExtractionResult,
  ExtractionStats,
  FileCategory,
  LoadingState,
  ExtractionState,
  UseExtractorReturn,
  ExtractorConfig,
} from "./types";

// Services
export {
  DEFAULT_CONFIG,
  categorizeMimeType,
  generateAttachmentId,
  formatFileSize,
  validateFile,
  extractMetadata,
  calculateChecksum,
  processFile,
  calculateStats,
  extractAttachments,
} from "./services";

// Hooks
export { useExtractor } from "./hooks";

// Components
export { AttachmentExtractorUI } from "./AttachmentExtractorUI";

// Fixtures
export { MOCK_FILES, MOCK_RESULTS, MOCK_ATTACHMENTS, MOCK_ERRORS } from "./fixtures";
