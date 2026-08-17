/**
 * Presentation-independent execution contract for the Escalation Tool.
 *
 * Consumers should branch on `ok` and `error.code`, never on raw error messages.
 */

export type EscalationPriority = "low" | "medium" | "high" | "urgent";

export type EscalationStatus = "open" | "in_review" | "resolved" | "dismissed";

export type EscalationErrorCode =
  | "INVALID_INPUT"
  | "INVALID_PRIORITY"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

export interface EscalationInput {
  /** ID of the conversation being escalated. */
  conversationId: string;
  /** Explicit reason for escalating. */
  reason: string;
  /** Escalation priority level. */
  priority: EscalationPriority;
  /** User or actor identity initiating the escalation. */
  requestedBy: string;
  /** Optional target team or department (e.g. "tier2-support", "compliance"). */
  targetDepartment?: string;
  /** Optional context or resolution instructions. */
  notes?: string;
  /** Optional opaque correlation ID propagated to output. */
  correlationId?: string;
}

export interface EscalationRecord {
  /** Generated unique escalation record ID. */
  id: string;
  conversationId: string;
  reason: string;
  priority: EscalationPriority;
  requestedBy: string;
  targetDepartment: string;
  status: EscalationStatus;
  createdAt: string;
  notes?: string;
  correlationId?: string;
}

export interface EscalationError {
  code: EscalationErrorCode;
  message: string;
  /** Dot-path to the field that triggered the validation error when applicable. */
  field?: string;
}

export type EscalationToolResult =
  | { ok: true; data: EscalationRecord }
  | { ok: false; error: EscalationError };

export type ExecuteEscalationTool = (input: EscalationInput) => Promise<EscalationToolResult>;
