/**
 * invoice-approval.service.ts — Invoice Approval Workflow (non-UI service)
 *
 * Presentation-free service boundary for the invoice approval contract. Wraps
 * the pure `applyInvoiceOperation` reducer into an `InvoiceContract` whose
 * `execute(...)` returns typed success/error results.
 */

import {
  InvoiceErrorCode,
  type InvoiceContract,
  type InvoiceOperation,
  type InvoiceContractOutput,
  type InvoiceResult,
  applyInvoiceOperation,
  fail,
} from "../contract";
import type { Invoice } from "../types";

/**
 * Build the invoice approval execution contract.
 *
 * State is held in an in-memory map so the contract is fully testable in
 * isolation with no network, no secrets, and no UI.
 */
export function createInvoiceApprovalContract(now: () => Date = () => new Date()): InvoiceContract {
  const invoices = new Map<string, Invoice>();
  return {
    execute(input: InvoiceOperation): InvoiceResult<InvoiceContractOutput> {
      try {
        return applyInvoiceOperation(invoices, input, now());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(InvoiceErrorCode.InvalidInput, message);
      }
    },
  };
}
