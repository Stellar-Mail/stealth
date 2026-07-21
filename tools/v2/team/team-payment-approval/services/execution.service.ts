/**
 * Payment Approval Execution Service (backend-facing)
 *
 * This is the non-UI service entry point for the Team Payment Approval tool.
 * It executes an approval/rejection decision against the local data services
 * and returns a typed {@link PaymentApprovalResult}.
 *
 * Design goals:
 * - Presentation-independent: no React, no DOM, no rendering.
 * - Reusable: callable from APIs, tests, and future automation.
 * - Stable errors: returns typed error codes, never throws for expected
 *   (handled) failures. Only truly unexpected failures surface as
 *   `INTERNAL_ERROR`.
 *
 * The executor is constructed via {@link createPaymentApprovalExecutor} with
 * injected dependencies so it can run against real services, fakes, or mocks.
 */

import type {
  PaymentApprovalContext,
  PaymentApprovalErrorCode,
  PaymentApprovalInput,
  PaymentApprovalResult,
  PaymentDecisionKind,
} from "../types/contract";
import type { PaymentRequest, ApprovalDecision, ApprovalStatus } from "../types/payment";

/** Minimal data-store surface the executor relies on. */
export interface PaymentApprovalStore {
  getPayment(id: string): PaymentRequest | undefined;
  recordDecision(decision: ApprovalDecision): void;
  getDecisions(paymentId: string): ApprovalDecision[];
}

const DEFAULT_ALLOWED_ROLES = ["admin", "manager"];

function normalizeIso(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  }
  return new Date().toISOString();
}

function isDecisionKind(value: unknown): value is PaymentDecisionKind {
  return value === "approve" || value === "reject";
}

/**
 * Validate the raw input against the execution contract.
 * Returns the first validation failure, or `null` when valid.
 */
function validateInput(input: PaymentApprovalInput): {
  code: PaymentApprovalErrorCode;
  message: string;
  field: string;
} | null {
  if (typeof input.paymentId !== "string" || input.paymentId.trim() === "") {
    return { code: "VALIDATION_FAILED", message: "paymentId is required", field: "paymentId" };
  }
  if (typeof input.approverId !== "string" || input.approverId.trim() === "") {
    return {
      code: "VALIDATION_FAILED",
      message: "approverId is required",
      field: "approverId",
    };
  }
  if (!isDecisionKind(input.decision)) {
    return {
      code: "VALIDATION_FAILED",
      message: 'decision must be "approve" or "reject"',
      field: "decision",
    };
  }
  if (input.notes !== undefined && typeof input.notes !== "string") {
    return { code: "VALIDATION_FAILED", message: "notes must be a string", field: "notes" };
  }
  if (
    input.decidedAt !== undefined &&
    typeof input.decidedAt !== "string" &&
    !(input.decidedAt instanceof Date)
  ) {
    return {
      code: "VALIDATION_FAILED",
      message: "decidedAt must be an ISO string or Date",
      field: "decidedAt",
    };
  }
  return null;
}

function authorized(context: PaymentApprovalContext | undefined): boolean {
  if (!context) {
    // No context supplied: local/demo mode bypasses authorization.
    return true;
  }
  const allowed = context.allowedRoles ?? DEFAULT_ALLOWED_ROLES;
  return allowed.includes(context.role);
}

function buildError(
  code: PaymentApprovalErrorCode,
  message: string,
  field?: string,
): PaymentApprovalResult {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

/** Dependencies for {@link createPaymentApprovalExecutor}. */
export interface PaymentApprovalExecutorDeps {
  store: PaymentApprovalStore;
}

/**
 * Create a backend-facing payment-approval executor.
 *
 * @param deps.store - Data store implementing the minimal payment/decision
 *   surface. The tool's singleton `paymentService` satisfies this contract.
 */
export function createPaymentApprovalExecutor({ store }: PaymentApprovalExecutorDeps) {
  function execute(input: PaymentApprovalInput): PaymentApprovalResult {
    try {
      const validation = validateInput(input);
      if (validation) {
        return buildError(validation.code, validation.message, validation.field);
      }

      const payment = store.getPayment(input.paymentId);
      if (!payment) {
        return buildError("PAYMENT_NOT_FOUND", `Payment "${input.paymentId}" not found`);
      }

      const existing = store.getDecisions(input.paymentId);
      if (existing.length > 0) {
        return buildError(
          "ALREADY_DECIDED",
          `Payment "${input.paymentId}" already has a recorded decision`,
        );
      }

      if (input.context && !authorized(input.context)) {
        return buildError(
          "UNAUTHORIZED",
          `Approver "${input.context.approverId}" is not authorized to decide payments`,
        );
      }

      if (
        input.context?.approvalLimit !== undefined &&
        payment.amount > input.context.approvalLimit
      ) {
        return buildError(
          "APPROVER_LIMIT_EXCEEDED",
          `Payment amount ${payment.amount} exceeds approver limit ${input.context.approvalLimit}`,
        );
      }

      const decidedAt = normalizeIso(input.decidedAt);
      const decision: ApprovalDecision = {
        approverId: input.approverId,
        paymentId: input.paymentId,
        decision: input.decision,
        notes: input.notes,
        decidedAt: new Date(decidedAt),
      };
      store.recordDecision(decision);

      const decisions = store.getDecisions(input.paymentId);
      const approvalCount = decisions.filter((d) => d.decision === "approve").length;
      const rejectionCount = decisions.filter((d) => d.decision === "reject").length;
      const status: ApprovalStatus = decision.decision === "approve" ? "approved" : "rejected";

      return {
        ok: true,
        data: {
          paymentId: input.paymentId,
          approverId: input.approverId,
          decision: input.decision,
          decidedAt,
          status,
          approvalCount,
          rejectionCount,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected execution failure";
      return buildError("INTERNAL_ERROR", message);
    }
  }

  return { execute };
}

export type PaymentApprovalExecutor = ReturnType<typeof createPaymentApprovalExecutor>;
