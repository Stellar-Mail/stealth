/**
 * Team Payment Approval - Execution Contract
 *
 * Backend-facing, presentation-independent contract that describes how the
 * payment-approval tool is executed by APIs, tests, and future automation.
 *
 * This contract deliberately avoids UI concerns. It does not reference React,
 * DOM, or any rendering primitives, and is safe to import in a server or CLI
 * context.
 *
 * Field-level behavior is documented inline. See CONTRACT.md for the full
 * schema, error-code catalog, execution flow, and extension guidance.
 */

// Re-export the existing domain vocabulary so consumers have a single import
// surface for the contract without reaching into the private domain types.
export type { ApprovalStatus, PaymentPriority } from "./payment";

import type { ApprovalStatus } from "./payment";

/**
 * Decision a caller can record against a payment request.
 */
export type PaymentDecisionKind = "approve" | "reject";

/**
 * Stable, typed error codes.
 *
 * Callers MUST NOT rely on `message` text for control flow; it is
 * human-readable only and may change. Use `code` to branch.
 */
export type PaymentApprovalErrorCode =
  | "VALIDATION_FAILED" // one or more input fields failed contract validation
  | "PAYMENT_NOT_FOUND" // the referenced paymentId does not exist
  | "ALREADY_DECIDED" // a terminal decision already exists for the payment
  | "UNAUTHORIZED" // caller lacks the required role / permission
  | "APPROVER_LIMIT_EXCEEDED" // decision amount exceeds approver approvalLimit
  | "INTERNAL_ERROR"; // unexpected failure inside the execution layer

/**
 * Typed input contract.
 *
 * Every field is documented with its expected behavior. Omitting a field or
 * passing an invalid value yields a `VALIDATION_FAILED` result.
 */
export interface PaymentApprovalInput {
  /** Stable identifier of the payment request being acted on. Required. */
  paymentId: string;

  /** Identity of the approver recording the decision. Required, non-empty. */
  approverId: string;

  /** Decision to record. Must be "approve" or "reject". Required. */
  decision: PaymentDecisionKind;

  /**
   * Optional free-form rationale. Used for audit only; never rendered as UI.
   * Must be a string when present (may be empty).
   */
  notes?: string;

  /**
   * Authoritative timestamp of the decision. Optional. When omitted the
   * execution layer stamps `decidedAt` with the current time. Acceptable as
   * an ISO-8601 string or a Date; the contract normalizes to an ISO string.
   */
  decidedAt?: string | Date;

  /**
   * Security context of the caller. Optional in local/demo usage but
   * REQUIRED for any authorized execution. When provided and `approver`
   * fails the policy check, the result is `UNAUTHORIZED`.
   */
  context?: PaymentApprovalContext;
}

/**
 * Security/authorization context for a single execution.
 * Presentation-independent: it carries only the claims needed to authorize.
 */
export interface PaymentApprovalContext {
  /** Approver identity, expected to match `approverId`. */
  approverId: string;

  /**
   * Role used for policy evaluation. Examples: "admin" | "manager" |
   * "agent" | "viewer". Unknown roles evaluate as `UNAUTHORIZED`.
   */
  role: string;

  /**
   * Optional monetary approval ceiling for the caller. If the referenced
   * payment's amount exceeds this value, the result is
   * `APPROVER_LIMIT_EXCEEDED`. Omit to skip the limit check (demo only).
   */
  approvalLimit?: number;

  /** Allowed roles for approving payments. Defaults to ["admin","manager"]. */
  allowedRoles?: string[];
}

/**
 * Typed output contract.
 *
 * `ok` is the discriminant: `true` for success, `false` for a handled error.
 * `error` is only present when `ok` is `false`.
 */
export interface PaymentApprovalResult {
  ok: boolean;
  /** Present and populated only when `ok` is `true`. */
  data?: PaymentApprovalSuccess;
  /** Present and populated only when `ok` is `false`. */
  error?: PaymentApprovalError;
}

/** Successful execution payload. */
export interface PaymentApprovalSuccess {
  paymentId: string;
  approverId: string;
  decision: PaymentDecisionKind;
  /** ISO-8601 timestamp the decision was recorded at. */
  decidedAt: string;
  /** Resulting status of the payment after this decision. */
  status: ApprovalStatus;
  /** Number of approvals recorded against the payment. */
  approvalCount: number;
  /** Number of rejections recorded against the payment. */
  rejectionCount: number;
}

/** Typed error payload. */
export interface PaymentApprovalError {
  code: PaymentApprovalErrorCode;
  /** Human-readable message. Not stable; do not branch on it. */
  message: string;
  /**
   * Field that triggered a `VALIDATION_FAILED` error, when applicable.
   * Absent for non-validation errors.
   */
  field?: string;
}

/** Function shape for the backend-facing service entry point. */
export type ExecutePaymentApproval = (input: PaymentApprovalInput) => PaymentApprovalResult;
