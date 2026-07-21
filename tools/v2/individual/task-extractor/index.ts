// Task Extractor — non-UI execution entry point.
//
// Everything a backend caller needs: the pure engine, the guarded service
// entry point, the typed contract, and fixtures. No UI code is exported.

export {
  extractTasks,
  resolveMaxTasks,
  DEFAULT_MAX_TASKS,
  MAX_TASKS_LIMIT,
  MAX_TASK_TEXT_CHARS,
  ACTION_VERBS,
  HIGH_PRIORITY_TERMS,
  LOW_PRIORITY_TERMS,
} from "./services/taskExtractor";
export {
  GUARD_LIMITS,
  checkInputLimits,
  safeExtractTasks,
  sanitizeInput,
  sanitizeText,
  validateInput,
  validateOptions,
} from "./services/guards";
export { successFixtures, failureFixtures } from "./services/fixtures";
export type { SuccessFixture, FailureFixture } from "./services/fixtures";
export type {
  ExtractedTask,
  SafeTaskExtractionResult,
  TaskConfidence,
  TaskExtractionErrorCode,
  TaskExtractionInput,
  TaskExtractionIssue,
  TaskExtractionOptions,
  TaskExtractionResult,
  TaskExtractionStats,
  TaskPriority,
  TaskSource,
  TaskTrigger,
} from "./types/taskExtractor";
