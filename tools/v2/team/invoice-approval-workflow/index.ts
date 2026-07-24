/**
 * index.ts — Invoice Approval Workflow
 *
 * Folder-local API surface. Exports the non-UI execution contract, its types,
 * and the service factory. Nothing in this file imports from the main app.
 */

// Types
export type { Invoice, InvoiceInput, InvoiceStatus, ApprovalDecision } from "./types";

// Contract + service
export { createInvoiceApprovalContract } from "./services/invoice-approval.service";
export {
  InvoiceErrorCode,
  applyInvoiceOperation,
  validateInvoiceInput,
  ok,
  fail,
} from "./contract";
export type {
  InvoiceContract,
  InvoiceOperation,
  InvoiceContractOutput,
  InvoiceResult,
} from "./contract";

// Fixtures
export { VALID_SUBMIT_INPUT, INVALID_AMOUNT_INPUT, MISSING_VENDOR_INPUT } from "./fixtures";
