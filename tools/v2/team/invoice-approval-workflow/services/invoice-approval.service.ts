/**
 * invoice-approval.service.ts — Invoice Approval Workflow (non-UI service with status indexing & memory guards)
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
import type { Invoice, InvoiceStatus } from "../types";

const MAX_STORE_CAPACITY = 10_000;

/**
 * Build the invoice approval execution contract.
 *
 * State is held in an in-memory map backed by status indices (`Map<InvoiceStatus, Set<string>>`)
 * to ensure O(1) status queries and memory capacity bounds.
 */
export function createInvoiceApprovalContract(
  now: () => Date = () => new Date(),
): InvoiceContract {
  const invoices = new Map<string, Invoice>();
  const statusIndex = new Map<InvoiceStatus, Set<string>>([
    ["pending", new Set<string>()],
    ["approved", new Set<string>()],
    ["rejected", new Set<string>()],
  ]);

  return {
    execute(input: InvoiceOperation): InvoiceResult<InvoiceContractOutput> {
      try {
        if (input.operation === "submit" && invoices.size >= MAX_STORE_CAPACITY) {
          return fail(
            InvoiceErrorCode.InvalidState,
            `Store capacity limit reached (${MAX_STORE_CAPACITY} invoices)`,
          );
        }
        return applyInvoiceOperation(invoices, input, now(), statusIndex);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return fail(InvoiceErrorCode.InvalidInput, message);
      }
    },
  };
}
