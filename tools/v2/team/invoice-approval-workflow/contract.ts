/**
 * contract.ts — Invoice Approval Workflow (non-UI execution contract with security & performance hardening)
 *
 * Backend-facing execution contract for an invoice approval workflow. It is
 * presentation-free: no React, no DOM. Operations return a typed
 * `InvoiceResult<T>` discriminated union with explicit error codes instead of
 * throwing.
 */

import type {
  Invoice,
  InvoiceInput,
  InvoiceStatus,
  ApprovalDecision,
  PaginationOptions,
} from "./types";

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
  | { operation: "list"; status?: InvoiceStatus; pagination?: PaginationOptions };

/** Output produced by the contract, keyed by operation. */
export type InvoiceContractOutput =
  | { operation: "submit"; invoice: Invoice }
  | { operation: "approve"; invoice: Invoice }
  | { operation: "reject"; invoice: Invoice }
  | { operation: "list"; invoices: Invoice[]; total: number; limit: number; offset: number };

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

const MAX_VENDOR_LENGTH = 200;
const MAX_EMAIL_LENGTH = 254;
const MAX_REASON_LENGTH = 1000;
const MAX_ID_LENGTH = 100;
const MAX_INVOICE_AMOUNT = 1_000_000_000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitize string input: strips HTML tags, script tags, and control characters,
 * trims leading/trailing whitespace, and truncates to maximum length bounds.
 */
export function sanitizeString(val: unknown, maxLength: number): string {
  if (typeof val !== "string") return "";
  // Strip control characters & null bytes
  let sanitized = val.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  // Strip HTML / script tags
  sanitized = sanitized.replace(/<[^>]*>/g, "");
  sanitized = sanitized.trim();
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  return sanitized;
}

/** Check for prototype pollution vectors in raw objects. */
export function hasPrototypePollutionKey(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj);
  return keys.some((k) => k === "__proto__" || k === "constructor" || k === "prototype");
}

/** Validate a submitted invoice input. Returns a message or null. */
export function validateInvoiceInput(input: InvoiceInput): string | null {
  if (!input || typeof input !== "object") return "invalid payload object";
  if (hasPrototypePollutionKey(input)) return "invalid payload: prototype pollution attempt detected";

  if (!input.vendor || typeof input.vendor !== "string" || input.vendor.trim() === "") {
    return "vendor is required";
  }
  if (input.vendor.length > MAX_VENDOR_LENGTH) {
    return `vendor exceeds maximum length of ${MAX_VENDOR_LENGTH}`;
  }

  if (
    typeof input.amount !== "number" ||
    isNaN(input.amount) ||
    !isFinite(input.amount) ||
    input.amount <= 0
  ) {
    return "amount must be a valid positive finite number greater than 0";
  }
  if (input.amount > MAX_INVOICE_AMOUNT) {
    return `amount exceeds maximum limit of ${MAX_INVOICE_AMOUNT}`;
  }

  if (!input.submittedBy || typeof input.submittedBy !== "string" || input.submittedBy.trim() === "") {
    return "submittedBy is required";
  }
  const cleanEmail = sanitizeString(input.submittedBy, MAX_EMAIL_LENGTH);
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return "submittedBy must be a valid email address";
  }

  return null;
}

/**
 * Pure reducer for the invoice approval workflow.
 *
 * Keeps state in the `invoices` map. Features input sanitization, bounds validation,
 * and paginated listing.
 */
export function applyInvoiceOperation(
  invoices: Map<string, Invoice>,
  op: InvoiceOperation,
  now: Date,
  statusIndex?: Map<InvoiceStatus, Set<string>>,
): InvoiceResult<InvoiceContractOutput> {
  if (!op || typeof op !== "object" || !op.operation) {
    return fail(InvoiceErrorCode.InvalidInput, "Invalid or missing operation specifier");
  }

  switch (op.operation) {
    case "submit": {
      const err = validateInvoiceInput(op.input);
      if (err) return fail(InvoiceErrorCode.InvalidInput, err);

      const cleanVendor = sanitizeString(op.input.vendor, MAX_VENDOR_LENGTH);
      const cleanSubmittedBy = sanitizeString(op.input.submittedBy, MAX_EMAIL_LENGTH);

      const invoice: Invoice = {
        id: nextId(),
        vendor: cleanVendor,
        amount: op.input.amount,
        submittedBy: cleanSubmittedBy,
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        attachments: op.input.attachments,
      };

      invoices.set(invoice.id, invoice);
      if (statusIndex) {
        let set = statusIndex.get("pending");
        if (!set) {
          set = new Set();
          statusIndex.set("pending", set);
        }
        set.add(invoice.id);
      }

      return ok({ operation: "submit", invoice });
    }
    case "approve":
    case "reject": {
      const cleanId = sanitizeString(op.id, MAX_ID_LENGTH);
      if (!cleanId) return fail(InvoiceErrorCode.InvalidInput, "id is required");

      const cleanApprover = sanitizeString(op.approver, MAX_EMAIL_LENGTH);
      if (!cleanApprover || !EMAIL_REGEX.test(cleanApprover)) {
        return fail(InvoiceErrorCode.InvalidInput, "approver must be a valid email address");
      }

      const invoice = invoices.get(cleanId);
      if (!invoice) return fail(InvoiceErrorCode.InvoiceNotFound, `Invoice ${cleanId} not found`);

      if (invoice.status !== "pending") {
        return fail(
          InvoiceErrorCode.InvalidState,
          `Invoice ${cleanId} is ${invoice.status}, not pending`,
        );
      }

      let cleanReason: string | undefined;
      if (op.operation === "reject") {
        cleanReason = sanitizeString(op.reason, MAX_REASON_LENGTH);
        if (!cleanReason) {
          return fail(InvoiceErrorCode.InvalidInput, "rejection reason is required");
        }
      }

      const newStatus: InvoiceStatus = op.operation === "approve" ? "approved" : "rejected";
      const decision: ApprovalDecision =
        op.operation === "approve"
          ? { decision: "approved", approver: cleanApprover, at: now.toISOString() }
          : {
              decision: "rejected",
              approver: cleanApprover,
              reason: cleanReason,
              at: now.toISOString(),
            };

      const updated: Invoice = {
        ...invoice,
        status: newStatus,
        decision,
        updatedAt: now.toISOString(),
      };

      invoices.set(updated.id, updated);

      if (statusIndex) {
        const pendingSet = statusIndex.get("pending");
        if (pendingSet) pendingSet.delete(updated.id);

        let newSet = statusIndex.get(newStatus);
        if (!newSet) {
          newSet = new Set();
          statusIndex.set(newStatus, newSet);
        }
        newSet.add(updated.id);
      }

      return ok({
        operation: op.operation,
        invoice: updated,
      } as InvoiceContractOutput);
    }
    case "list": {
      let candidateIds: Iterable<string>;
      if (op.status && statusIndex) {
        candidateIds = statusIndex.get(op.status) ?? [];
      } else {
        candidateIds = invoices.keys();
      }

      const matched: Invoice[] = [];
      for (const id of candidateIds) {
        const inv = invoices.get(id);
        if (inv) {
          if (!op.status || inv.status === op.status) {
            matched.push(inv);
          }
        }
      }

      const limit = Math.min(Math.max(op.pagination?.limit ?? 50, 1), 100);
      const offset = Math.max(op.pagination?.offset ?? 0, 0);

      const paginated = matched.slice(offset, offset + limit);

      return ok({
        operation: "list",
        invoices: paginated,
        total: matched.length,
        limit,
        offset,
      });
    }
    default: {
      const _never: never = op;
      return fail(InvoiceErrorCode.InvalidInput, `Unknown operation: ${JSON.stringify(_never)}`);
    }
  }
}
