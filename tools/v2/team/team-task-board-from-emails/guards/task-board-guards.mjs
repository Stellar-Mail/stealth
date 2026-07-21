import { TaskBoardError, TaskBoardErrorCode } from "./task-board-errors.mjs";

const DEFAULT_ALLOWED_ROLES = ["agent", "manager"];

/**
 * Validate the top-level `CreateTaskInput` payload.
 *
 * Throws `TaskBoardError` with a stable code on the first violation. The
 * per-field `MALFORMED_EMAIL` check is delegated to `validateEmail`.
 */
export function validateCreateTaskInput(input) {
  if (!input || typeof input !== "object") {
    throw new TaskBoardError(TaskBoardErrorCode.INVALID_INPUT, "Input must be an object");
  }

  if (!input.email || typeof input.email !== "object") {
    throw new TaskBoardError(
      TaskBoardErrorCode.INVALID_EMAIL,
      "Input must include an `email` object",
    );
  }

  validateEmail(input.email);

  if (input.context !== undefined) {
    if (typeof input.context !== "object" || input.context === null) {
      throw new TaskBoardError(
        TaskBoardErrorCode.INVALID_INPUT,
        "context must be an object when provided",
      );
    }
    if (typeof input.context.requesterId !== "string" || input.context.requesterId.trim() === "") {
      throw new TaskBoardError(TaskBoardErrorCode.INVALID_INPUT, "context.requesterId is required");
    }
    if (typeof input.context.role !== "string" || input.context.role.trim() === "") {
      throw new TaskBoardError(TaskBoardErrorCode.INVALID_INPUT, "context.role is required");
    }
  }
}

/**
 * Validate a single `EmailInput` against the contract.
 *
 * Every required field must be present and well-typed. Empty strings are
 * rejected for id/threadId/from/subject/body/receivedAt because the extraction
 * heuristics depend on them.
 */
export function validateEmail(email) {
  if (!email || typeof email !== "object") {
    throw new TaskBoardError(TaskBoardErrorCode.MALFORMED_EMAIL, "email must be an object");
  }

  const requiredStringFields = [
    ["id", email.id],
    ["threadId", email.threadId],
    ["from", email.from],
    ["subject", email.subject],
    ["receivedAt", email.receivedAt],
    ["body", email.body],
  ];

  for (const [field, value] of requiredStringFields) {
    if (typeof value !== "string" || value.trim() === "") {
      throw new TaskBoardError(
        TaskBoardErrorCode.MALFORMED_EMAIL,
        `email.${field} is required and must be a non-empty string`,
        field,
      );
    }
  }

  if (!Array.isArray(email.to)) {
    throw new TaskBoardError(TaskBoardErrorCode.MALFORMED_EMAIL, "email.to must be an array", "to");
  }

  const received = new Date(email.receivedAt);
  if (Number.isNaN(received.getTime())) {
    throw new TaskBoardError(
      TaskBoardErrorCode.MALFORMED_EMAIL,
      "email.receivedAt must be a valid ISO date-time string",
      "receivedAt",
    );
  }
}

/**
 * Evaluate whether the caller's context is authorized to extract tasks.
 *
 * When no context is supplied (local/demo mode) authorization is bypassed.
 */
export function isAuthorized(context) {
  if (!context) return true;
  const allowed = context.allowedRoles ?? DEFAULT_ALLOWED_ROLES;
  return allowed.includes(context.role);
}
