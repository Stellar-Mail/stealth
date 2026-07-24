/**
 * contract.ts — Invoice Approval Workflow (non-UI execution contract)
 *
 * Backend-facing execution contract for an invoice approval workflow. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `InvoiceResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type { Invoice, InvoiceInput, InvoiceStatus, ApprovalDecision } from "./types";

/** Explicit, machine-readable error codes for contract operations. */
export enum InvoiceErrorCode {
  /** A required field was missing or failed validation (e.g. amount <= 0). */
  InvalidInput = "INVALID_INPUT",
  /** The referenced invoice was not found. */
  InvoiceNotFound = "INVOICE_NOT_FOUND",
  /** The invoice is not in a state that allows the requested decision. */
  InvalidState = "INVALID_STATE",
  /** The approver is not authorized to decide this invoice. */
  Unauthorized = "UNAUTHORIZED",
}

/** Discriminated outcome returned by every contract operation. */
export type InvoiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: InvoiceErrorCode; message: string };

/** Operations supported by the invoice approval contract. */
export type InvoiceOperation =
  | { operation: "submit"; input: InvoiceInput }
  | { operation: "approve"; id: string; approver: string }
  | { operation: "reject"; id: string; approver: string; reason: string }
  | { operation: "list"; status?: InvoiceStatus };

/** Output produced by the contract, keyed by operation. */
export type InvoiceContractOutput =
  | { operation: "submit"; invoice: Invoice }
  | { operation: "approve"; invoice: Invoice }
  | { operation: "reject"; invoice: Invoice }
  | { operation: "list"; invoices: Invoice[] };

/** Backend-facing entry point for the invoice approval workflow. */
export interface InvoiceContract {
  execute(input: InvoiceOperation): InvoiceResult<InvoiceContractOutput>;
}

/** Typed success outcome. */
export function ok<T>(value: T): InvoiceResult<T> {
  return { ok: true, value };
}

/** Typed error outcome. */
export function fail<T = never>(error: InvoiceErrorCode, message: string): InvoiceResult<T> {
  return { ok: false, error, message };
}

let seq = 0;
function nextId(): string {
  seq += 1;
  return `inv-${String(seq).padStart(3, "0")}`;
}

/** Validate a submitted invoice input. Returns a message or null. */
export function validateInvoiceInput(input: InvoiceInput): string | null {
  if (!input.vendor || input.vendor.trim() === "") return "vendor is required";
  if (!input.amount || input.amount <= 0) return "amount must be greater than 0";
  if (!input.submittedBy || input.submittedBy.trim() === "") return "submittedBy is required";
  return null;
}

/**
 * Pure reducer for the invoice approval workflow.
 *
 * Keeps all state in the `invoices` map; deterministic given inputs. The
 * `now` parameter is injectable so approvals/rejections are testable.
 */
export function applyInvoiceOperation(
  invoices: Map<string, Invoice>,
  op: InvoiceOperation,
  now: Date,
): InvoiceResult<InvoiceContractOutput> {
  switch (op.operation) {
    case "submit": {
      const err = validateInvoiceInput(op.input);
      if (err) return fail(InvoiceErrorCode.InvalidInput, err);
      const invoice: Invoice = {
        id: nextId(),
        vendor: op.input.vendor,
        amount: op.input.amount,
        submittedBy: op.input.submittedBy,
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      invoices.set(invoice.id, invoice);
      return ok({ operation: "submit", invoice });
    }
    case "approve":
    case "reject": {
      const invoice = invoices.get(op.id);
      if (!invoice) return fail(InvoiceErrorCode.InvoiceNotFound, `Invoice ${op.id} not found`);
      if (invoice.status !== "pending")
        return fail(
          InvoiceErrorCode.InvalidState,
          `Invoice ${op.id} is ${invoice.status}, not pending`,
        );
      const decision: ApprovalDecision =
        op.operation === "approve"
          ? { decision: "approved", approver: op.approver, at: now.toISOString() }
          : {
              decision: "rejected",
              approver: op.approver,
              reason: op.reason,
              at: now.toISOString(),
            };
      const updated: Invoice = {
        ...invoice,
        status: decision.decision === "approved" ? "approved" : "rejected",
        decision,
        updatedAt: now.toISOString(),
      };
      invoices.set(updated.id, updated);
      return ok({
        operation: op.operation,
        invoice: updated,
      } as InvoiceContractOutput);
    }
    case "list": {
      const all = [...invoices.values()];
      const filtered = op.status ? all.filter((i) => i.status === op.status) : all;
      return ok({ operation: "list", invoices: filtered });
    }
    default: {
      const _never: never = op;
      return fail(InvoiceErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(_never)}`);
    }
  }
}
