// Readability Improver — non-UI execution entry point.
//
// Everything a backend caller needs: the pure engine, the guarded service
// entry point, the typed contract, and fixtures. No UI code is exported.

export {
  improveReadability,
  countSyllables,
  resolveMaxIssues,
  DEFAULT_MAX_ISSUES,
  MAX_ISSUES_LIMIT,
  LONG_SENTENCE_WORDS,
  VERY_LONG_SENTENCE_WORDS,
  LONG_PARAGRAPH_WORDS,
  COMPLEX_WORD_SYLLABLES,
  MAX_EXCERPT_CHARS,
  PLAIN_LANGUAGE_REPLACEMENTS,
} from "./services/readabilityImprover";
export {
  GUARD_LIMITS,
  checkInputLimits,
  safeImproveReadability,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "./services/guards";
export { successFixtures, failureFixtures } from "./services/fixtures";
export type { SuccessFixture, FailureFixture } from "./services/fixtures";
export type {
  IssueSeverity,
  IssueSource,
  ReadabilityErrorCode,
  ReadabilityGrade,
  ReadabilityInput,
  ReadabilityIssue,
  ReadabilityIssueType,
  ReadabilityMetrics,
  ReadabilityOptions,
  ReadabilityResult,
  ReadabilityStats,
  ReadabilityValidationIssue,
  SafeReadabilityResult,
} from "./types/readabilityImprover";
