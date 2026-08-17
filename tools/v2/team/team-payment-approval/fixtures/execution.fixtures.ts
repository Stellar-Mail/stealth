import type { PaymentApprovalInput, PaymentApprovalContext } from "../types/contract";
import type { PaymentApprovalStore } from "../services/execution.service";
import type { PaymentRequest, ApprovalDecision } from "../types/payment";

/**
 * Execution-contract fixtures for the Team Payment Approval tool.
 *
 * These are presentation-independent: they exercise the backend-facing
 * {@link paymentApprovalExecutor} and cover the four required scenarios:
 * successful execution, validation failure, authorization failure, and
 * unexpected internal/service failure.
 */

/** A payment that exists in the local store and is still pending. */
export const fixturePendingPayment: PaymentRequest = {
  id: "exec-payment-1",
  recipient: "Acme Corp",
  amount: 5000,
  currency: "USD",
  description: "Q1 Service Contract Payment",
  requestedBy: "Alice Johnson",
  requestedAt: new Date("2026-06-20T12:00:00Z"),
  deadline: new Date("2026-06-30T12:00:00Z"),
  priority: "normal",
  status: "pending",
};

/** A payment whose amount exceeds a typical approver limit. */
export const fixtureHighValuePayment: PaymentRequest = {
  ...fixturePendingPayment,
  id: "exec-payment-2",
  recipient: "Stellar Development",
  amount: 125000,
  description: "Infrastructure costs",
  priority: "high",
};

/** A context representing an authorized manager approver. */
export const fixtureAuthorizedContext: PaymentApprovalContext = {
  approverId: "user-manager-1",
  role: "manager",
  approvalLimit: 100000,
};

/** A context representing an unauthorized viewer. */
export const fixtureUnauthorizedContext: PaymentApprovalContext = {
  approverId: "user-viewer-1",
  role: "viewer",
};

/** A context representing an authorized manager whose limit is too low. */
export const fixtureLimitedContext: PaymentApprovalContext = {
  approverId: "user-manager-2",
  role: "manager",
  approvalLimit: 50000,
};

/** Successful approval input against the pending payment. */
export const fixtureApproveInput: PaymentApprovalInput = {
  paymentId: fixturePendingPayment.id,
  approverId: "user-manager-1",
  decision: "approve",
  notes: "Verified contract, approving",
  context: fixtureAuthorizedContext,
};

/** Successful rejection input against the pending payment. */
export const fixtureRejectInput: PaymentApprovalInput = {
  paymentId: fixturePendingPayment.id,
  approverId: "user-manager-1",
  decision: "reject",
  notes: "Budget hold",
  context: fixtureAuthorizedContext,
};

/** Validation failure: missing required paymentId. */
export const fixtureValidationFailureInput: PaymentApprovalInput = {
  paymentId: "",
  approverId: "user-manager-1",
  decision: "approve",
};

/** Validation failure: invalid decision value. */
export const fixtureInvalidDecisionInput: PaymentApprovalInput = {
  paymentId: fixturePendingPayment.id,
  approverId: "user-manager-1",
  decision: "maybe" as PaymentApprovalInput["decision"],
};

/** Authorization failure: viewer context against the pending payment. */
export const fixtureAuthorizationFailureInput: PaymentApprovalInput = {
  paymentId: fixturePendingPayment.id,
  approverId: "user-viewer-1",
  decision: "approve",
  context: fixtureUnauthorizedContext,
};

/** Authorization failure: approver limit exceeded. */
export const fixtureLimitExceededInput: PaymentApprovalInput = {
  paymentId: fixtureHighValuePayment.id,
  approverId: "user-manager-2",
  decision: "approve",
  context: fixtureLimitedContext,
};

/** Payment not found: references a missing id. */
export const fixtureNotFoundInput: PaymentApprovalInput = {
  paymentId: "exec-payment-missing",
  approverId: "user-manager-1",
  decision: "approve",
  context: fixtureAuthorizedContext,
};

/**
 * A minimal store that throws on `getPayment` to simulate an unexpected
 * internal/service failure. Used by the internal-failure fixture test.
 */
export function createFailingStore() {
  return {
    getPayment(): PaymentRequest | undefined {
      throw new Error("Simulated datastore outage");
    },
    recordDecision(_decision: ApprovalDecision): void {
      throw new Error("Simulated datastore outage");
    },
    getDecisions(_paymentId: string): ApprovalDecision[] {
      throw new Error("Simulated datastore outage");
    },
  } satisfies PaymentApprovalStore;
}
