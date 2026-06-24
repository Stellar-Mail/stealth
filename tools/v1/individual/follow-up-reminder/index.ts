export {
  buildFollowUpReminder,
  isReminderDuplicate,
  summarizeReminder,
  EXPLICIT_REQUEST_TERMS,
  LOW_CONFIDENCE_TERMS,
  MAX_SCAN_LENGTH,
  MILLISECONDS_PER_DAY,
  NUMBER_WORDS,
} from "./services/followUpReminder";
export type {
  BuildReminderOptions,
  ExistingReminderKey,
  NormalizedEmailInput,
  ReminderConfidence,
  ReminderReviewModel,
  ReminderSignal,
  ReminderState,
  SignalType,
} from "./services/followUpReminder";
export { sampleEmails, sampleEmailList } from "./services/fixtures";
export {
  GUARD_LIMITS,
  checkInputLimits,
  checkOptionsLimits,
  safeBuildFollowUpReminder,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "./services/guards";
export type { GuardErrorCode, GuardIssue, SafeBuildResult } from "./services/guards";
