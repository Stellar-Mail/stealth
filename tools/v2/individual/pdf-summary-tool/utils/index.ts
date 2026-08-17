/**
 * PDF Summary Tool - Utils Index
 *
 * Export all utility functions and fixtures from this module.
 * Utils are pure functions with no side effects.
 *
 * Modules:
 * - execution-contract: Typed input/output validation for backend service
 * - text-analysis: Text analysis, keyword extraction, readability metrics
 * - fixtures: Test data for success and failure cases
 */

// Execution Contract Utilities
export {
  isValidAction,
  validateSummarizePdfPayload,
  validateValidatePdfPayload,
  validateGetSummaryPayload,
  validateDeleteSummaryPayload,
  createSuccessOutput,
  createErrorOutput,
  isSuccessOutput,
  isErrorOutput,
  castSummarizePdfPayload,
  castValidatePdfPayload,
  castGetSummaryPayload,
  castDeleteSummaryPayload,
} from "./execution-contract";

// Text Analysis Utilities
export {
  extractKeywords,
  isContentLongEnough,
  getWordCount,
  getSentenceCount,
  splitIntoSentences,
  splitIntoParagraphs,
  estimateReadingTimeMinutes,
  getCharacterDensity,
  normalizeText,
  removeUrls,
  removeEmails,
  guessLanguage,
} from "./text-analysis";

// Test Fixtures (for unit tests)
export * from "./fixtures";
