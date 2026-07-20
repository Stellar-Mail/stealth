/**
 * Execution contract for Mail-to-Ticket Converter.
 * Non-UI, backend-facing types for mail-to-ticket execution.
 */

/** Error codes for mail-to-ticket execution failures */
export type MailToTicketErrorCode =
  | "INVALID_INPUT"
  | "EMAIL_NOT_FOUND"
  | "DUPLICATE_TICKET"
  | "ASSIGNMENT_FAILED"
  | "STATUS_TRANSITION_INVALID"
  | "PERSISTENCE_FAILED"
  | "INTERNAL_ERROR";

/** Input for converting an email to a ticket */
export interface MailToTicketInput {
  /** ID of the source email */
  emailId: string;
  /** Ticket subject */
  subject: string;
  /** Ticket description */
  description: string;
  /** Priority level */
  priority: "low" | "medium" | "high" | "critical";
  /** Ticket category */
  category: "bug" | "feature-request" | "support" | "billing" | "other";
  /** Optional team member to assign */
  assignedTo?: string;
  /** Identity creating the ticket */
  createdBy: string;
}

/** Output from successful ticket creation */
export interface MailToTicketOutput {
  /** Unique ticket identifier */
  id: string;
  /** Reference to source email */
  emailId: string;
  /** Ticket subject */
  subject: string;
  /** Ticket description */
  description: string;
  /** Priority level */
  priority: "low" | "medium" | "high" | "critical";
  /** Current status */
  status: "open" | "in-progress" | "resolved" | "closed";
  /** Ticket category */
  category: "bug" | "feature-request" | "support" | "billing" | "other";
  /** Assigned team member id */
  assignedTo: string | null;
  /** Creator identity */
  createdBy: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Resolution notes */
  resolution: string | null;
}

/** Error result structure */
export interface MailToTicketError {
  code: MailToTicketErrorCode;
  message: string;
  /** Dot-path to invalid field when applicable */
  field?: string;
}

/** Discriminated union result type */
export type MailToTicketResult =
  { ok: true; data: MailToTicketOutput } | { ok: false; error: MailToTicketError };

/** Execution function type signature */
export type ExecuteMailToTicket = (input: MailToTicketInput) => Promise<MailToTicketResult>;
