/** Public, presentation-independent API for team-security-flagging. */
export {
  createSecurityFlaggingExecutor,
  executeSecurityFlagging,
  executeSecurityFlaggingWithState,
  SecurityFlaggingErrorCode,
  SecurityFlaggingExecutionStatus,
} from "./services/security-flagging-execution.service.mjs";
export {
  SecurityGuardError,
  guardSecurityFlaggingInput,
  guardDedupBatchSize,
  guardAndValidate,
  LIMITS as GuardLimits,
} from "./guards/security-guards.mjs";
export type {
  SecurityFlaggingDependencies,
  SecurityFlaggingError,
  SecurityFlaggingErrorCode as SecurityFlaggingErrorCodeType,
  SecurityFlaggingExecutor,
  SecurityFlaggingExecutionState,
  SecurityFlaggingInput,
  SecurityFlaggingOutput,
  SecurityFlaggingRecord,
  SecurityFlaggingStateObserver,
} from "./contract/execution-contract";
