// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import {
  createPaymentApprovalExecutor,
  type PaymentApprovalStore,
} from "../services/execution.service";
import { paymentService, paymentApprovalExecutor } from "../services";
import type { PaymentRequest, ApprovalDecision } from "../types/payment";
import type { PaymentApprovalInput } from "../types/contract";
import {
  fixturePendingPayment,
  fixtureHighValuePayment,
  fixtureApproveInput,
  fixtureRejectInput,
  fixtureValidationFailureInput,
  fixtureInvalidDecisionInput,
  fixtureAuthorizationFailureInput,
  fixtureLimitExceededInput,
  fixtureNotFoundInput,
  createFailingStore,
} from "../fixtures/execution.fixtures";

/** In-memory store used to drive deterministic contract tests. */
function createMemoryStore(seed: PaymentRequest[] = []): PaymentApprovalStore {
  const payments = new Map<string, PaymentRequest>();
  const decisions = new Map<string, ApprovalDecision[]>();
  seed.forEach((p) => payments.set(p.id, { ...p }));
  return {
    getPayment: (id) => payments.get(id),
    recordDecision: (d) => {
      const list = decisions.get(d.paymentId) ?? [];
      list.push(d);
      decisions.set(d.paymentId, list);
    },
    getDecisions: (paymentId) => decisions.get(paymentId) ?? [],
  };
}

describe("paymentApprovalExecutor - contract", () => {
  beforeEach(() => {
    paymentService.clear();
  });

  describe("successful execution", () => {
    it("approves a pending payment and returns typed success", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });

      const result = executor.execute(fixtureApproveInput);

      expect(result.ok).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        paymentId: fixturePendingPayment.id,
        approverId: fixtureApproveInput.approverId,
        decision: "approve",
        decidedAt: expect.any(String),
        status: "approved",
        approvalCount: 1,
        rejectionCount: 0,
      });
    });

    it("rejects a pending payment and reports rejection counts", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });

      const result = executor.execute(fixtureRejectInput);

      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe("rejected");
      expect(result.data?.rejectionCount).toBe(1);
      expect(result.data?.approvalCount).toBe(0);
    });

    it("normalizes a Date decidedAt into an ISO string", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });
      const input: PaymentApprovalInput = {
        ...fixtureApproveInput,
        decidedAt: new Date("2026-06-25T08:00:00Z"),
      };

      const result = executor.execute(input);

      expect(result.ok).toBe(true);
      expect(result.data?.decidedAt).toBe("2026-06-25T08:00:00.000Z");
    });

    it("allows local/demo execution without a context (no authz)", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });
      const input: PaymentApprovalInput = {
        paymentId: fixturePendingPayment.id,
        approverId: "local-user",
        decision: "approve",
      };

      const result = executor.execute(input);

      expect(result.ok).toBe(true);
    });
  });

  describe("validation failure", () => {
    it("rejects a missing paymentId with VALIDATION_FAILED", () => {
      const executor = createPaymentApprovalExecutor({ store: createMemoryStore() });

      const result = executor.execute(fixtureValidationFailureInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_FAILED");
      expect(result.error?.field).toBe("paymentId");
    });

    it("rejects an invalid decision value", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });

      const result = executor.execute(fixtureInvalidDecisionInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_FAILED");
      expect(result.error?.field).toBe("decision");
    });
  });

  describe("authorization / permission failure", () => {
    it("rejects an unauthorized viewer with UNAUTHORIZED", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixturePendingPayment]),
      });

      const result = executor.execute(fixtureAuthorizationFailureInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("UNAUTHORIZED");
    });

    it("rejects when amount exceeds approver limit", () => {
      const executor = createPaymentApprovalExecutor({
        store: createMemoryStore([fixtureHighValuePayment]),
      });

      const result = executor.execute(fixtureLimitExceededInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("APPROVER_LIMIT_EXCEEDED");
    });
  });

  describe("unexpected internal / service failure", () => {
    it("returns INTERNAL_ERROR instead of throwing", () => {
      const executor = createPaymentApprovalExecutor({ store: createFailingStore() });

      const result = executor.execute(fixtureApproveInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("boundary conditions", () => {
    it("returns PAYMENT_NOT_FOUND for a missing payment", () => {
      const executor = createPaymentApprovalExecutor({ store: createMemoryStore() });

      const result = executor.execute(fixtureNotFoundInput);

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe("PAYMENT_NOT_FOUND");
    });

    it("returns ALREADY_DECIDED when a decision exists", () => {
      const store = createMemoryStore([fixturePendingPayment]);
      const executor = createPaymentApprovalExecutor({ store });
      expect(executor.execute(fixtureApproveInput).ok).toBe(true);

      const second = executor.execute(fixtureRejectInput);
      expect(second.ok).toBe(false);
      expect(second.error?.code).toBe("ALREADY_DECIDED");
    });
  });

  describe("singleton entry point", () => {
    it("paymentApprovalExecutor bound to paymentService works end-to-end", () => {
      paymentService.addPayment(fixturePendingPayment);
      const result = paymentApprovalExecutor.execute({
        paymentId: fixturePendingPayment.id,
        approverId: "local-user",
        decision: "approve",
      });
      expect(result.ok).toBe(true);
      expect(result.data?.status).toBe("approved");
    });
  });
});
