/**
 * Team Payment Approval Tool - Main Export
 *
 * Public API for the Team Payment Approval tool.
 * Only export what's needed for external use.
 */

// Components
export {
  TeamPaymentApprovalTool,
  PaymentApprovalList,
  PaymentApprovalForm,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./components";

export type {
  TeamPaymentApprovalToolProps,
  PaymentApprovalListProps,
  PaymentApprovalFormProps,
  EmptyStateProps,
  LoadingStateProps,
  ErrorStateProps,
  SuccessStateProps,
} from "./components";

// Hooks
export { usePaymentApproval, usePaymentRequests } from "./hooks";

export type { UsePaymentApprovalOptions, UsePaymentRequestsOptions } from "./hooks";

// Services
export { paymentService, decisionService, persistentDecisionService } from "./services";

// Types
export type {
  PaymentRequest,
  PaymentApprover,
  ApprovalDecision,
  ApprovalWorkflow,
  ApprovalStatus,
  PaymentPriority,
} from "./types";

// Fixtures (for testing/demo)
export {
  mockPayments,
  getMockPayment,
  getMockPendingPayments,
  getMockPaymentsByPriority,
  completedPayments,
} from "./fixtures/payments.fixtures";

// Execution-contract fixtures (backend-facing, presentation-independent)
export {
  fixturePendingPayment,
  fixtureHighValuePayment,
  fixtureAuthorizedContext,
  fixtureUnauthorizedContext,
  fixtureLimitedContext,
  fixtureApproveInput,
  fixtureRejectInput,
  fixtureValidationFailureInput,
  fixtureInvalidDecisionInput,
  fixtureAuthorizationFailureInput,
  fixtureLimitExceededInput,
  fixtureNotFoundInput,
  createFailingStore,
} from "./fixtures/execution.fixtures";

// Backend-facing service entry point (non-UI)
export { paymentApprovalExecutor } from "./services";
export { createPaymentApprovalExecutor } from "./services";
export type {
  PaymentApprovalExecutor,
  PaymentApprovalExecutorDeps,
  PaymentApprovalStore,
} from "./services";

// Execution contract types
export type {
  PaymentDecisionKind,
  PaymentApprovalErrorCode,
  PaymentApprovalInput,
  PaymentApprovalContext,
  PaymentApprovalResult,
  PaymentApprovalSuccess,
  PaymentApprovalError,
  ExecutePaymentApproval,
} from "./types";
