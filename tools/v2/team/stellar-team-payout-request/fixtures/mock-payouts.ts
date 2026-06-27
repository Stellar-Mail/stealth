/**
 * Stellar Team Payout Request — Mock Fixtures
 *
 * Deterministic test data. Never use production keys or real account IDs.
 * All Stellar account IDs below are well-formed but fictitious testnet keys.
 */

import type { PayoutRequest, PayoutFormData, StellarAccountInfo } from "../types";

export const MOCK_USER_ID = "user-test-001";

/**
 * A valid 56-character testnet-style Stellar public key used as a placeholder.
 * This is the Stellar Friendbot account — safe to use in fixtures.
 */
export const MOCK_STELLAR_ID = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const mockPendingPayout: PayoutRequest = {
  id: "payout-001",
  userId: MOCK_USER_ID,
  recipientEmail: "alice@example.com",
  recipientStellarId: MOCK_STELLAR_ID,
  amount: "50.0000000",
  memo: "Q2 team bonus",
  status: "pending",
  createdAt: "2025-01-15T10:00:00.000Z",
  updatedAt: "2025-01-15T10:00:00.000Z",
};

export const mockSubmittedPayout: PayoutRequest = {
  id: "payout-002",
  userId: MOCK_USER_ID,
  recipientEmail: "bob@example.com",
  amount: "120.5000000",
  status: "submitted",
  transactionId: "tx-abc123",
  createdAt: "2025-01-14T08:30:00.000Z",
  updatedAt: "2025-01-14T08:35:00.000Z",
  submittedAt: "2025-01-14T08:35:00.000Z",
};

export const mockConfirmedPayout: PayoutRequest = {
  id: "payout-003",
  userId: MOCK_USER_ID,
  recipientEmail: "carol@example.com",
  amount: "200.0000000",
  memo: "Sprint 42 completion",
  status: "confirmed",
  transactionId: "tx-def456",
  createdAt: "2025-01-10T12:00:00.000Z",
  updatedAt: "2025-01-10T12:10:00.000Z",
  submittedAt: "2025-01-10T12:05:00.000Z",
  confirmedAt: "2025-01-10T12:10:00.000Z",
};

export const mockFailedPayout: PayoutRequest = {
  id: "payout-004",
  userId: MOCK_USER_ID,
  recipientEmail: "dave@example.com",
  amount: "75.0000000",
  status: "failed",
  error: "Destination account does not exist",
  createdAt: "2025-01-13T16:00:00.000Z",
  updatedAt: "2025-01-13T16:02:00.000Z",
};

export const mockCancelledPayout: PayoutRequest = {
  id: "payout-005",
  userId: MOCK_USER_ID,
  recipientEmail: "eve@example.com",
  amount: "30.0000000",
  status: "cancelled",
  createdAt: "2025-01-12T09:00:00.000Z",
  updatedAt: "2025-01-12T09:01:00.000Z",
};

export const allMockPayouts: PayoutRequest[] = [
  mockPendingPayout,
  mockSubmittedPayout,
  mockConfirmedPayout,
  mockFailedPayout,
  mockCancelledPayout,
];

export const mockValidFormData: PayoutFormData = {
  recipientEmail: "alice@example.com",
  amount: "50.00",
  memo: "Team payout",
};

export const mockStellarAccount: StellarAccountInfo = {
  id: MOCK_STELLAR_ID,
  balance: "1000.0000000",
  sequenceNumber: "123456789",
};
