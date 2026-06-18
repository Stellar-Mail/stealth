/**
 * Team Payment Approval Types
 *
 * Local type definitions for the Team Payment Approval tool.
 * Do not wire these into the main app's wallet or Stellar integration.
 */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type PaymentPriority = "low" | "normal" | "high" | "urgent";

export interface PaymentRequest {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  deadline?: Date;
  priority: PaymentPriority;
  status: ApprovalStatus;
  notes?: string;
}

export interface PaymentApprover {
  id: string;
  name: string;
  email: string;
  role: string;
  approvalLimit?: number;
}

export interface ApprovalDecision {
  approverId: string;
  paymentId: string;
  decision: "approve" | "reject";
  notes?: string;
  decidedAt: Date;
}

export interface ApprovalWorkflow {
  id: string;
  paymentId: string;
  status: "pending" | "completed" | "escalated";
  requiredApprovals: number;
  approvals: ApprovalDecision[];
  rejections: ApprovalDecision[];
  createdAt: Date;
  completedAt?: Date;
}
