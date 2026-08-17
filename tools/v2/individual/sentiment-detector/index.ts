// Sentiment Detector — non-UI execution entry point.
//
// Everything a backend caller needs: the pure engine, the guarded service
// entry point, the typed contract, and fixtures. No UI code is exported.

export {
  analyzeSentiment,
  resolveMaxSignals,
  DEFAULT_MAX_SIGNALS,
  MAX_SIGNALS_LIMIT,
  SUBJECT_WEIGHT_MULTIPLIER,
  INTENSIFIER_MULTIPLIER,
  NEGATION_WINDOW,
  NEUTRAL_BAND,
  MIXED_RATIO,
  POSITIVE_TERMS,
  NEGATIVE_TERMS,
  NEGATION_TERMS,
  INTENSIFIER_TERMS,
} from "./services/sentimentDetector";
export {
  GUARD_LIMITS,
  checkInputLimits,
  safeAnalyzeSentiment,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "./services/guards";
export { successFixtures, failureFixtures } from "./services/fixtures";
export type { SuccessFixture, FailureFixture } from "./services/fixtures";
export type {
  SafeSentimentResult,
  SentimentAnalysisInput,
  SentimentAnalysisOptions,
  SentimentAnalysisResult,
  SentimentConfidence,
  SentimentErrorCode,
  SentimentIssue,
  SentimentLabel,
  SentimentSignal,
  SentimentStats,
  SignalPolarity,
  SignalSource,
} from "./types/sentimentDetector";
