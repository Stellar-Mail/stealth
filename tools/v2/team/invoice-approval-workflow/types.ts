/**
 * types.ts — Invoice Approval Workflow (non-UI execution contract)
 *
 * Domain types for the invoice approval workflow. No imports from the main
 * app; presentation-free.
 */

/** Lifecycle status of an invoice in the approval workflow. */
export type InvoiceStatus = "pending" | "approved" | "rejected";

/** A recorded approval/rejection decision. */
export interface ApprovalDecision {
  decision: "approved" | "rejected";
  approver: string;
  /** Reason is required for rejections. */
  reason?: string;
  /** ISO-8601 timestamp. */
  at: string;
}

/** Input for submitting a new invoice. */
export interface InvoiceInput {
  vendor: string;
  amount: number;
  submittedBy: string;
}

/** A persisted invoice with its current workflow state. */
export interface Invoice {
  id: string;
  vendor: string;
  amount: number;
  submittedBy: string;
  status: InvoiceStatus;
  /** ISO-8601 timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp. */
  updatedAt: string;
  decision?: ApprovalDecision;
}
