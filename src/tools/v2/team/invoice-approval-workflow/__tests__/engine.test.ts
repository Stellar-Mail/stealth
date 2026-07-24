import { describe, it, expect } from "vitest";
import { canProcessInvoice, processInvoiceAction, calculatePendingTotal } from "../engine";
import {
  mockPendingInvoice,
  mockApprovedInvoice,
  mockRejectedInvoice,
  mockInvoiceList,
} from "../__fixtures__/mockInvoices";
import type { ApprovalAction, Invoice } from "../types";

describe("canProcessInvoice", () => {
  it("returns true for a PENDING invoice", () => {
    expect(canProcessInvoice(mockPendingInvoice)).toBe(true);
  });

  it("returns false for an already-decided (APPROVED) invoice", () => {
    expect(canProcessInvoice(mockApprovedInvoice)).toBe(false);
  });

  it("returns false for an already-decided (REJECTED) invoice", () => {
    expect(canProcessInvoice(mockRejectedInvoice)).toBe(false);
  });
});

describe("processInvoiceAction", () => {
  const approver = "usr_admin999";

  it("approves a PENDING invoice and stamps the approver", () => {
    const action: ApprovalAction = {
      invoiceId: mockPendingInvoice.id,
      action: "APPROVE",
      approverId: approver,
    };
    const result = processInvoiceAction(mockPendingInvoice, action);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("APPROVED");
    expect(result.data?.approverId).toBe(approver);
  });

  it("rejects a PENDING invoice with a reason and records it in notes", () => {
    const action: ApprovalAction = {
      invoiceId: mockPendingInvoice.id,
      action: "REJECT",
      approverId: approver,
      reason: "Over budget",
    };
    const result = processInvoiceAction(mockPendingInvoice, action);
    expect(result.success).toBe(true);
    expect(result.data?.status).toBe("REJECTED");
    expect(result.data?.notes).toContain("[REJECT]: Over budget");
  });

  it("does not mutate the input invoice (immutable update)", () => {
    const before: Invoice = { ...mockPendingInvoice };
    const action: ApprovalAction = {
      invoiceId: mockPendingInvoice.id,
      action: "APPROVE",
      approverId: approver,
    };
    processInvoiceAction(mockPendingInvoice, action);
    expect(mockPendingInvoice.status).toBe("PENDING");
    expect(mockPendingInvoice).toEqual(before);
  });

  it("fails when the invoice is not PENDING", () => {
    const action: ApprovalAction = {
      invoiceId: mockApprovedInvoice.id,
      action: "APPROVE",
      approverId: approver,
    };
    const result = processInvoiceAction(mockApprovedInvoice, action);
    expect(result.success).toBe(false);
    expect(result.error).toContain(mockApprovedInvoice.status);
  });

  it("fails when the action invoiceId does not match the invoice", () => {
    const action: ApprovalAction = {
      invoiceId: "inv_other",
      action: "APPROVE",
      approverId: approver,
    };
    const result = processInvoiceAction(mockPendingInvoice, action);
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not match");
  });

  it("fails when rejecting without a reason", () => {
    const action: ApprovalAction = {
      invoiceId: mockPendingInvoice.id,
      action: "REJECT",
      approverId: approver,
    };
    const result = processInvoiceAction(mockPendingInvoice, action);
    expect(result.success).toBe(false);
    expect(result.error).toContain("reason");
  });
});

describe("calculatePendingTotal", () => {
  it("sums only PENDING invoices in the requested currency", () => {
    // mockInvoiceList: inv_001 (USD 1500 PENDING), inv_004 (USD 300 PENDING)
    expect(calculatePendingTotal(mockInvoiceList, "USD")).toBe(1800);
  });

  it("ignores non-USD currencies", () => {
    expect(calculatePendingTotal(mockInvoiceList, "EUR")).toBe(0);
  });

  it("ignores already-decided invoices", () => {
    // Approved EUR invoice (450.5) must not count
    expect(calculatePendingTotal(mockInvoiceList, "EUR")).toBe(0);
  });

  it("returns 0 for an empty list", () => {
    expect(calculatePendingTotal([], "USD")).toBe(0);
  });
});
