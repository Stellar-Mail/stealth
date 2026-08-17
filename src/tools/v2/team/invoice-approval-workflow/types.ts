export type InvoiceStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  submitterId: string;
  vendorName: string;
  status: InvoiceStatus;
  createdAt: string;
  dueDate: string;
  notes?: string;
  approverId?: string;
}

export interface ApprovalAction {
  invoiceId: string;
  action: "APPROVE" | "REJECT";
  approverId: string;
  reason?: string;
}

export interface WorkflowResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
