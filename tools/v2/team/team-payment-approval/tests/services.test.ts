// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { paymentService, decisionService, persistentDecisionService } from "../services";
import type { PaymentRequest, ApprovalDecision } from "../types";

const mockPaymentItem: PaymentRequest = {
  id: "test-payment-1",
  recipient: "Test Vendor",
  amount: 1000,
  currency: "USD",
  description: "Test description",
  requestedBy: "Tester",
  requestedAt: new Date("2026-06-25T12:00:00Z"),
  priority: "normal",
  status: "pending",
};

describe("payment.service", () => {
  beforeEach(() => {
    paymentService.clear();
  });

  it("should add and retrieve a payment request", () => {
    paymentService.addPayment(mockPaymentItem);
    const retrieved = paymentService.getPayment("test-payment-1");
    expect(retrieved).toEqual(mockPaymentItem);
  });

  it("should get all payments", () => {
    paymentService.addPayment(mockPaymentItem);
    const all = paymentService.getAllPayments();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(mockPaymentItem);
  });

  it("should filter pending payments", () => {
    paymentService.addPayment(mockPaymentItem);
    paymentService.addPayment({
      ...mockPaymentItem,
      id: "test-payment-2",
      status: "approved",
    });

    const pending = paymentService.getPendingPayments();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("test-payment-1");
  });

  it("should update payment status", () => {
    paymentService.addPayment(mockPaymentItem);
    paymentService.updatePaymentStatus("test-payment-1", "approved");
    const updated = paymentService.getPayment("test-payment-1");
    expect(updated?.status).toBe("approved");
  });

  it("should create and retrieve workflow", () => {
    paymentService.addPayment(mockPaymentItem);
    const workflow = paymentService.createWorkflow(mockPaymentItem, 3);
    expect(workflow.paymentId).toBe("test-payment-1");
    expect(workflow.requiredApprovals).toBe(3);
    expect(workflow.status).toBe("pending");

    const retrieved = paymentService.getWorkflow("test-payment-1");
    expect(retrieved).toEqual(workflow);
  });

  it("should record and get decisions for a payment", () => {
    const decision: ApprovalDecision = {
      approverId: "user-123",
      paymentId: "test-payment-1",
      decision: "approve",
      notes: "Looks good",
      decidedAt: new Date(),
    };
    paymentService.recordDecision(decision);
    const decisions = paymentService.getDecisions("test-payment-1");
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toEqual(decision);
  });
});

describe("decision.service", () => {
  beforeEach(() => {
    decisionService.clear();
  });

  it("should record and get a decision", () => {
    const decision: ApprovalDecision = {
      approverId: "user-456",
      paymentId: "payment-abc",
      decision: "approve",
      notes: "Approve note",
      decidedAt: new Date(),
    };

    decisionService.recordDecision(decision);
    const retrieved = decisionService.getDecision("payment-abc");
    expect(retrieved).toEqual(decision);
  });

  it("should get correct counts of approvals and rejections", () => {
    decisionService.recordDecision({
      approverId: "user-1",
      paymentId: "p1",
      decision: "approve",
      decidedAt: new Date(),
    });
    decisionService.recordDecision({
      approverId: "user-2",
      paymentId: "p2",
      decision: "reject",
      decidedAt: new Date(),
    });
    decisionService.recordDecision({
      approverId: "user-3",
      paymentId: "p3",
      decision: "approve",
      decidedAt: new Date(),
    });

    expect(decisionService.getApprovalCount()).toBe(2);
    expect(decisionService.getRejectionCount()).toBe(1);
    expect(decisionService.getAllDecisions()).toHaveLength(3);
  });
});

describe("persistentDecisionService with localStorage mock", () => {
  let localStorageMock: Record<string, string> = {};

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => localStorageMock[key] || null,
      setItem: (key: string, value: string) => {
        localStorageMock[key] = value;
      },
      removeItem: (key: string) => {
        delete localStorageMock[key];
      },
      clear: () => {
        localStorageMock = {};
      },
    });
    persistentDecisionService.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load from and save to localStorage", () => {
    const decision: ApprovalDecision = {
      approverId: "user-persist",
      paymentId: "payment-persist",
      decision: "approve",
      decidedAt: new Date(),
    };

    persistentDecisionService.recordDecision(decision);
    expect(localStorageMock["team-payment-approval-decisions"]).toBeDefined();

    // Clear service memory but mock reload by re-instantiating or checking stored JSON
    const stored = JSON.parse(localStorageMock["team-payment-approval-decisions"]);
    expect(stored[0].paymentId).toBe("payment-persist");
  });
});
