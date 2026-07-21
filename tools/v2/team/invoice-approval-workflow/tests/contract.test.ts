/**
 * contract.test.ts — Invoice Approval Workflow (execution contract)
 *
 * Verifies the non-UI execution contract: typed inputs/outputs, the
 * submit → approve/reject → list lifecycle, and the edge/error paths
 * (validation, unknown invoice, invalid state). No UI is exercised.
 */

import { describe, it, expect } from "vitest";
import { createInvoiceApprovalContract } from "../services/invoice-approval.service";
import {
  InvoiceErrorCode,
  ok,
  fail,
  type InvoiceResult,
  type InvoiceContractOutput,
} from "../contract";
import { VALID_SUBMIT_INPUT, INVALID_AMOUNT_INPUT, MISSING_VENDOR_INPUT } from "../fixtures";

describe("invoice approval contract — result helpers", () => {
  it("ok() produces a typed success result", () => {
    const r = ok("v");
    expect(r).toEqual({ ok: true, value: "v" });
  });

  it("fail() produces a typed error result with code + message", () => {
    const r = fail(InvoiceErrorCode.InvalidInput, "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe(InvoiceErrorCode.InvalidInput);
      expect(r.message).toBe("bad");
    }
  });
});

describe("invoice approval contract — lifecycle", () => {
  it("submit creates a pending invoice with a generated id", () => {
    const contract = createInvoiceApprovalContract();
    const res = contract.execute({ operation: "submit", input: VALID_SUBMIT_INPUT });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "submit") {
      expect(res.value.invoice.id).toMatch(/^inv-\d{3}$/);
      expect(res.value.invoice.status).toBe("pending");
      expect(res.value.invoice.amount).toBe(VALID_SUBMIT_INPUT.amount);
    }
  });

  it("approve moves a pending invoice to approved with a decision", () => {
    const contract = createInvoiceApprovalContract();
    const sub = contract.execute({ operation: "submit", input: VALID_SUBMIT_INPUT });
    expect(sub.ok).toBe(true);
    const id = sub.ok && sub.value.operation === "submit" ? sub.value.invoice.id : "";
    const res = contract.execute({ operation: "approve", id, approver: "lead@acme.example.com" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "approve") {
      expect(res.value.invoice.status).toBe("approved");
      expect(res.value.invoice.decision?.decision).toBe("approved");
      expect(res.value.invoice.decision?.approver).toBe("lead@acme.example.com");
    }
  });

  it("reject records a reason and moves the invoice to rejected", () => {
    const contract = createInvoiceApprovalContract();
    const sub = contract.execute({ operation: "submit", input: VALID_SUBMIT_INPUT });
    const id = sub.ok && sub.value.operation === "submit" ? sub.value.invoice.id : "";
    const res = contract.execute({
      operation: "reject",
      id,
      approver: "lead@acme.example.com",
      reason: "Over budget this quarter",
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "reject") {
      expect(res.value.invoice.status).toBe("rejected");
      expect(res.value.invoice.decision?.reason).toBe("Over budget this quarter");
    }
  });

  it("list returns all invoices, and can be filtered by status", () => {
    const contract = createInvoiceApprovalContract();
    contract.execute({ operation: "submit", input: VALID_SUBMIT_INPUT });
    const res = contract.execute({ operation: "list" });
    expect(res.ok).toBe(true);
    if (res.ok && res.value.operation === "list") {
      expect(res.value.invoices.length).toBe(1);
      expect(res.value.invoices[0].status).toBe("pending");
    }
    const pending = contract.execute({ operation: "list", status: "approved" });
    if (pending.ok && pending.value.operation === "list") {
      expect(pending.value.invoices.length).toBe(0);
    }
  });
});

describe("invoice approval contract — error handling", () => {
  it("submit rejects a non-positive amount (no throw)", () => {
    const contract = createInvoiceApprovalContract();
    const res: InvoiceResult<InvoiceContractOutput> = contract.execute({
      operation: "submit",
      input: INVALID_AMOUNT_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(InvoiceErrorCode.InvalidInput);
  });

  it("submit rejects a missing vendor (no throw)", () => {
    const contract = createInvoiceApprovalContract();
    const res: InvoiceResult<InvoiceContractOutput> = contract.execute({
      operation: "submit",
      input: MISSING_VENDOR_INPUT,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(InvoiceErrorCode.InvalidInput);
  });

  it("approve of an unknown invoice maps to InvoiceNotFound (no throw)", () => {
    const contract = createInvoiceApprovalContract();
    const res: InvoiceResult<InvoiceContractOutput> = contract.execute({
      operation: "approve",
      id: "inv-999",
      approver: "lead@acme.example.com",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(InvoiceErrorCode.InvoiceNotFound);
  });

  it("approve of an already-decided invoice maps to InvalidState (no throw)", () => {
    const contract = createInvoiceApprovalContract();
    const sub = contract.execute({ operation: "submit", input: VALID_SUBMIT_INPUT });
    const id = sub.ok && sub.value.operation === "submit" ? sub.value.invoice.id : "";
    contract.execute({ operation: "approve", id, approver: "lead@acme.example.com" });
    const res: InvoiceResult<InvoiceContractOutput> = contract.execute({
      operation: "approve",
      id,
      approver: "lead@acme.example.com",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe(InvoiceErrorCode.InvalidState);
  });
});
