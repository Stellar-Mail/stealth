export {
  buildSequence,
  summarizeSequence,
  isSequenceDuplicate,
  EXPLICIT_FOLLOW_UP_TERMS,
  URGENCY_TERMS,
  LOW_PRIORITY_TERMS,
  DEFAULT_SEQUENCE_TEMPLATES,
  MAX_SCAN_LENGTH,
  MILLISECONDS_PER_DAY,
} from "./services/followUpSequenceBuilder";
export type {
  FollowUpSequence,
  FollowUpStep,
  SequenceBuildInput,
  SequenceBuildOptions,
  SequenceConfidence,
  SequenceSignal,
  SequenceStage,
  ExistingSequenceKey,
  UrgencyLevel,
} from "./services/followUpSequenceBuilder";
export { sampleInputs, sampleInputList } from "./services/fixtures";
export {
  GUARD_LIMITS,
  checkInputLimits,
  checkOptionsLimits,
  safeBuildSequence,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "./services/guards";
export type { GuardErrorCode, GuardIssue, SafeBuildResult } from "./services/guards";
