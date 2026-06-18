/**
 * Stellar Team Payout Request — Public API Surface
 *
 * Import only from this file when consuming the tool from sibling tooling.
 * Do NOT wire this into the main application shell, routing, or wallet core.
 */

// Types
export type {
  PayoutFormData,
  PayoutRequest,
  PayoutStatus,
  ValidationResult,
  StellarAccountInfo,
} from "./types";

// Services
export { PayoutService, payoutService } from "./services/payout.service";
export {
  validatePayoutFormData,
  isValidEmail,
  isValidAmount,
  isValidMemo,
  isValidStellarAccountId,
} from "./services/validation";

// Fixtures (for testing / demo usage only)
export {
  allMockPayouts,
  mockPendingPayout,
  mockSubmittedPayout,
  mockConfirmedPayout,
  mockFailedPayout,
  mockCancelledPayout,
  mockValidFormData,
  mockStellarAccount,
  MOCK_USER_ID,
  MOCK_STELLAR_ID,
} from "./fixtures/mock-payouts";
