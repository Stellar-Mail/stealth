/**
 * Stable, machine-readable error codes for the team-task-board-from-emails
 * execution contract.
 *
 * Non-UI callers (schedulers, inbox jobs, other services) can branch on
 * `error.code` instead of parsing human-readable messages, which keeps the
 * contract stable even if the wording of a message changes.
 */
export const TaskBoardErrorCode = Object.freeze({
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_EMAIL: "INVALID_EMAIL",
  MALFORMED_EMAIL: "MALFORMED_EMAIL",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

/**
 * Error raised by the task-board guards when an input payload violates the
 * execution contract. Always carries a `code` from `TaskBoardErrorCode`.
 */
export class TaskBoardError extends Error {
  constructor(code, message, field) {
    super(message);
    this.name = "TaskBoardError";
    this.code = code;
    if (field !== undefined) {
      this.field = field;
    }
  }
}
