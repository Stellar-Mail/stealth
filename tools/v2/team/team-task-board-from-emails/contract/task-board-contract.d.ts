/**
 * Typed execution contract for the team-task-board-from-emails tool.
 *
 * This declaration file documents the backend-facing (non-UI) inputs and
 * outputs consumed and produced by the service entry points in `services/`.
 * The services are plain `.mjs` modules; these types exist so callers,
 * reviewers, and editors can rely on a stable, machine-checkable contract
 * with no runtime dependency and no build step.
 *
 * The contract is presentation-independent: it does not reference React, the
 * DOM, or any rendering primitive, and is safe to import in a server, worker,
 * or scheduler context.
 */

/** A single source email from a shared team mailbox. */
export interface EmailInput {
  /** Stable email identifier. Required, non-empty. */
  id: string;
  /** Thread the email belongs to. Required, non-empty. */
  threadId: string;
  /** Sender address. Required, non-empty. */
  from: string;
  /** Recipient addresses. Required array (may be empty). */
  to: string[];
  /** Email subject line. Required (may be empty string). */
  subject: string;
  /** ISO date-time the email was received. Required, valid ISO-8601. */
  receivedAt: string;
  /** Email body text. Required (may be empty string). */
  body: string;
  /** Optional NLP/heuristics hints supplied by an upstream classifier. */
  signals?: string[];
}

/** Source context describing who requested the task extraction. */
export interface TaskBoardContext {
  /** Identity of the caller performing extraction. Required. */
  requesterId: string;
  /** Role used for policy evaluation (e.g. "agent" | "manager"). */
  role: string;
  /** Roles permitted to extract tasks. Defaults to ["agent", "manager"]. */
  allowedRoles?: string[];
}

/** Input payload for the `createTaskFromEmail` execution entry point. */
export interface CreateTaskInput {
  /** The source email to convert into a task card. Required. */
  email: EmailInput;
  /** Optional authorization context. When omitted, local/demo mode skips authz. */
  context?: TaskBoardContext;
}

/** A board task card derived from an email thread. */
export interface TaskCard {
  /** Stable task identifier derived from the source email id. */
  id: string;
  /** Short action label extracted from the email. */
  title: string;
  /** Assigned team member, department, or "unassigned". */
  owner: string;
  /** ISO date string (YYYY-MM-DD) or null when undetermined. */
  dueDate: string | null;
  /** Relative urgency. */
  priority: "low" | "medium" | "high";
  /** Board column the card belongs to. */
  status: "new" | "triage" | "blocked" | "done";
  /** Identifier of the source email the card was derived from. */
  sourceEmailId: string;
  /** True when extraction needs human confirmation. */
  reviewRequired: boolean;
  /** Optional context or reasoning for review. */
  notes?: string;
}

/** Result envelope returned by the execution entry points. */
export interface TaskBoardResult {
  /** Discriminant: true on success, false on a handled error. */
  ok: boolean;
  /** Present and populated only when `ok` is true. */
  data?: TaskCard;
  /** Present and populated only when `ok` is false. */
  error?: TaskBoardErrorPayload;
}

/** Typed error payload carried on a failed result. */
export interface TaskBoardErrorPayload {
  /** Stable, machine-readable error code. Branch on this, not on `message`. */
  code: TaskBoardErrorCode;
  /** Human-readable message. Not stable across versions. */
  message: string;
  /** Offending field, present only for validation errors. */
  field?: string;
}

/** Stable error codes for the task-board execution contract. */
export type TaskBoardErrorCode =
  | "INVALID_EMAIL" // input failed the email contract
  | "INVALID_INPUT" // top-level input shape was wrong
  | "MALFORMED_EMAIL" // required email fields missing/empty or bad types
  | "UNAUTHORIZED" // caller role is not permitted to extract tasks
  | "INTERNAL_ERROR"; // unexpected failure inside the execution layer

/** Re-export existing domain types for a single import surface. */
export type { TaskBoard, LoadState, TaskBoardServiceConfig } from "../types";
