/**
 * Stellar Team Payout Request Tool - Public API
 *
 * This is the single entry point for consumers of this tool.
 * Only the exports below are considered stable.
 *
 * V2 isolated tool — do not wire into the main app until a future
 * integration issue explicitly permits it.
 */

// ─── Components ───────────────────────────────────────────────────────────────

export {
  StellarPayoutRequestTool,
  PayoutForm,
  PayoutStatusDisplay,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./components";

export type {
  StellarPayoutRequestToolProps,
  PayoutFormProps,
  PayoutStatusProps,
  EmptyStateProps,
  LoadingStateProps,
  ErrorStateProps,
  SuccessStateProps,
} from "./components";

// ─── Hooks ────────────────────────────────────────────────────────────────────

export { usePayoutRequest, useStellarAccount } from "./hooks";

// ─── Services ─────────────────────────────────────────────────────────────────

export { payoutService, stellarService, validatePayoutRequest } from "./services";
export type { StellarNetwork } from "./services";

// ─── Types ────────────────────────────────────────────────────────────────────

export type {
  PayoutRequest,
  PayoutFormData,
  PayoutValidationResult,
  PayoutStatus,
  StellarAccount,
  StellarTransaction,
  TransactionResult,
  TransactionStatus,
  StellarAsset,
} from "./types";

export { ValidationError, StellarNetworkError } from "./types";

// ─── Fixtures (testing / demo only) ──────────────────────────────────────────

export {
  mockPayouts,
  mockStellarAccounts,
  TEST_KEYPAIRS,
  getMockPayout,
  getMockPayoutsByStatus,
} from "./fixtures/payouts.fixtures";
