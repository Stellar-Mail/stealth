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
