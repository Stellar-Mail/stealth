/**
 * Stellar Team Payout Request — Public API
 *
 * Self-contained V2 tool. Do not import into the main application until
 * a future integration issue explicitly allows it.
 */

// Main component
export { StellarTeamPayoutRequest } from "./components";
export type { StellarTeamPayoutRequestProps } from "./components";

// Sub-components
export {
  EmptyState,
  ErrorState,
  LoadingState,
  PayoutRequestForm,
  PayoutRequestList,
  SuccessState,
} from "./components";

export type {
  EmptyStateProps,
  ErrorStateProps,
  LoadingStateProps,
  PayoutRequestFormProps,
  PayoutRequestListProps,
  SuccessStateProps,
} from "./components";

// Hook
export { usePayoutRequest } from "./hooks/use-payout-request";

// Types
export type {
  PayoutRequest,
  PayoutRecipient,
  PayoutFormValues,
  PayoutValidationError,
  PayoutStatus,
  PayoutPriority,
  StellarNetwork,
} from "./types";

// Fixtures (for testing / demo only)
export {
  mockPayouts,
  getMockPayout,
  getMockPendingPayouts,
  getMockPayoutsByStatus,
  getMockPayoutsByPriority,
} from "./fixtures/payouts.fixtures";
