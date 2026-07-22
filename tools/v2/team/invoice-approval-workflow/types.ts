/**
 * Domain types for the Invoice Approval Workflow tool.
 */

export type InvoiceStatus = "pending" | "approved" | "rejected";

export interface InvoiceAttachmentMeta {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

export interface InvoiceInput {
  vendor: string;
  amount: number;
  submittedBy: string;
  attachments?: readonly InvoiceAttachmentMeta[];
}

export interface ApprovalDecision {
  decision: "approved" | "rejected";
  approver: string;
  reason?: string;
  at: string;
}

export interface Invoice {
  id: string;
  vendor: string;
  amount: number;
  submittedBy: string;
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  decision?: ApprovalDecision;
  attachments?: readonly InvoiceAttachmentMeta[];
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}
