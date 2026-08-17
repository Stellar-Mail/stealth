import { Invoice, ApprovalAction, WorkflowResult } from "./types";

/**
 * Validates if an invoice can be transitioned based on its current status.
 */
export const canProcessInvoice = (invoice: Invoice): boolean => {
  return invoice.status === "PENDING";
};

/**
 * Processes an approval or rejection action on an invoice.
 * This is a pure helper that returns a new Invoice object (immutable update)
 * or an error state if the transition is invalid.
 */
export const processInvoiceAction = (
  invoice: Invoice,
  action: ApprovalAction,
): WorkflowResult<Invoice> => {
  if (!canProcessInvoice(invoice)) {
    return {
      success: false,
      error: `Cannot process invoice ${invoice.id}. Current status is ${invoice.status}.`,
    };
  }

  if (action.invoiceId !== invoice.id) {
    return {
      success: false,
      error: "Action invoice ID does not match the provided invoice.",
    };
  }

  if (action.action === "REJECT" && !action.reason) {
    return {
      success: false,
      error: "A reason must be provided when rejecting an invoice.",
    };
  }

  const updatedInvoice: Invoice = {
    ...invoice,
    status: action.action === "APPROVE" ? "APPROVED" : "REJECTED",
    approverId: action.approverId,
    notes: action.reason
      ? `${invoice.notes || ""}\n[${action.action}]: ${action.reason}`.trim()
      : invoice.notes,
  };

  return {
    success: true,
    data: updatedInvoice,
  };
};

/**
 * Calculates the total outstanding pending amount for a specific currency.
 */
export const calculatePendingTotal = (invoices: Invoice[], currency: string): number => {
  return invoices
    .filter((inv) => inv.status === "PENDING" && inv.currency === currency)
    .reduce((sum, inv) => sum + inv.amount, 0);
};
