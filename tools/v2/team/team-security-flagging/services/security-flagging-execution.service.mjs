/** Backend-facing execution service. No UI, DOM, or infrastructure imports. */
import {
  SecurityFlagError,
  sanitizeText,
  validateCategory,
  validateCreateFlagInput,
  validateDescription,
  validateEmail,
  validateEmailId,
  validateEvidence,
  validateSeverity,
  validateThreadId,
} from "./security-flagging.service.mjs";

export const SecurityFlaggingErrorCode = Object.freeze({
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED_REPORTER: "UNAUTHORIZED_REPORTER",
  DUPLICATE_FLAG: "DUPLICATE_FLAG",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/**
 * Presentation-independent lifecycle states for a future caller.
 * `loading` is emitted before any dependency is invoked; the terminal state
 * contains the same result returned by the executor.
 */
export const SecurityFlaggingExecutionStatus = Object.freeze({
  LOADING: "loading",
  SUCCESS: "success",
  ERROR: "error",
});

function failure(code, message, details = {}) {
  return { ok: false, error: { code, message, ...details } };
}

function validateAndNormalize(input) {
  validateCreateFlagInput(input);
  const subject = sanitizeText(input.subject);
  if (!subject) throw new SecurityFlagError("subject is required", "subject");

  return {
    emailId: validateEmailId(input.emailId),
    threadId: validateThreadId(input.threadId),
    reportedBy: validateEmail(input.reportedBy),
    severity: validateSeverity(input.severity),
    category: validateCategory(input.category),
    subject,
    senderEmail: validateEmail(input.senderEmail),
    description: validateDescription(input.description),
    evidence: validateEvidence(input.evidence ?? []),
  };
}

/** Bind the executor to explicit authorization, storage, id, and clock boundaries. */
export function createSecurityFlaggingExecutor(dependencies) {
  if (!dependencies || typeof dependencies !== "object") {
    throw new TypeError("Security flagging dependencies are required");
  }

  async function execute(input) {
    let normalized;
    try {
      normalized = validateAndNormalize(input);
    } catch (error) {
      if (error instanceof SecurityFlagError) {
        return failure(SecurityFlaggingErrorCode.INVALID_INPUT, error.message, {
          ...(error.field ? { field: error.field } : {}),
        });
      }
      return failure(SecurityFlaggingErrorCode.INVALID_INPUT, "Input must match the contract");
    }

    try {
      if (!(await dependencies.authorizeReporter(normalized.reportedBy))) {
        return failure(
          SecurityFlaggingErrorCode.UNAUTHORIZED_REPORTER,
          "Reporter is not authorized to create security flags",
        );
      }

      const existingFlagId = await dependencies.findActiveFlag({
        emailId: normalized.emailId,
        threadId: normalized.threadId,
      });
      if (existingFlagId) {
        return failure(
          SecurityFlaggingErrorCode.DUPLICATE_FLAG,
          "An active security flag already exists for this email",
          { existingFlagId },
        );
      }

      const timestamp = dependencies.now().toISOString();
      const record = {
        id: dependencies.generateId(),
        ...normalized,
        status: "new",
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      try {
        await dependencies.persistFlag(record);
      } catch {
        return failure(
          SecurityFlaggingErrorCode.PERSISTENCE_FAILED,
          "The security flag could not be persisted",
        );
      }
      return { ok: true, data: record };
    } catch {
      return failure(
        SecurityFlaggingErrorCode.INTERNAL_ERROR,
        "Unexpected security flagging execution failure",
      );
    }
  }

  return Object.freeze({ execute });
}

/** One-shot non-UI service entry point. */
export function executeSecurityFlagging(input, dependencies) {
  return createSecurityFlaggingExecutor(dependencies).execute(input);
}

/**
 * Execute while reporting deterministic lifecycle updates to a caller-supplied
 * observer. The observer is optional and intentionally has no UI dependency.
 */
export async function executeSecurityFlaggingWithState(input, dependencies, onState) {
  if (onState !== undefined && typeof onState !== "function") {
    throw new TypeError("Security flagging state observer must be a function");
  }

  onState?.({ status: SecurityFlaggingExecutionStatus.LOADING });
  const result = await executeSecurityFlagging(input, dependencies);
  onState?.({
    status: result.ok
      ? SecurityFlaggingExecutionStatus.SUCCESS
      : SecurityFlaggingExecutionStatus.ERROR,
    result,
  });
  return result;
}
