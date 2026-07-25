export {
  DEFAULT_MAX_BODY_WORDS,
  MAX_BODY_WORDS_LIMIT,
  writeColdEmail,
} from "./services/coldEmailWriter";
export {
  COLD_EMAIL_INPUT_LIMITS,
  checkColdEmailInputLimits,
  safeWriteColdEmail,
  sanitizeColdEmailInput,
  sanitizeColdEmailText,
  validateColdEmailInput,
  validateColdEmailOptions,
} from "./services/guards";
export { failureFixtures, successFixtures } from "./services/fixtures";
export type { ColdEmailFailureFixture, ColdEmailSuccessFixture } from "./services/fixtures";
export type {
  ColdEmailParty,
  ColdEmailTone,
  ColdEmailWriterErrorCode,
  ColdEmailWriterInput,
  ColdEmailWriterOptions,
  ColdEmailWriterOutput,
  ColdEmailWriterValidationIssue,
  SafeColdEmailWriterResult,
} from "./types/coldEmailWriter";
