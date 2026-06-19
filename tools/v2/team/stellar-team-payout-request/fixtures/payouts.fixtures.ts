/**
 * Payout Fixtures
 *
 * Deterministic test data for unit and integration tests.
 * All Stellar keys here are TESTNET ONLY — never use in production.
 *
 * Testnet keypairs were generated for testing purposes and hold no
 * real value. They are safe to commit in this context.
 */
import type { PayoutRequest, StellarAccount } from "../types";

// ─── Test Keypairs (testnet only) ─────────────────────────────────────────────

export const TEST_KEYPAIRS = {
  /** Funded testnet account A */
  accountA: {
    publicKey: "GD6WVYRVID442Y4JVWFWKWCZKB45UGHJAABBJRS22TUSTWSTVNXZMAHJ",
    // secret: SB... — omitted from commit; set via VITE_TEST_KEYPAIR_SECRET
    secretEnvVar: "VITE_TEST_KEYPAIR_SECRET_A",
  },
  /** Funded testnet account B (payout destination) */
  accountB: {
    publicKey: "GDOEVDDBU6OBWKL7VHDAOKD77UP4DKHQYKOKJJT5PR3WRDBTX35HUEUX",
    secretEnvVar: "VITE_TEST_KEYPAIR_SECRET_B",
  },
} as const;

// ─── Mock Payout Requests ──────────────────────────────────────────────────────

export const mockPayouts: PayoutRequest[] = [
  {
    id: "payout-001",
    userId: "user-alice",
    recipientEmail: "alice@example.com",
    recipientStellarId: TEST_KEYPAIRS.accountA.publicKey,
    amount: "50.0000000",
    asset: "native",
    memo: "Q2 team payout",
    status: "confirmed",
    transactionId: "d8e8fca2dc0f896fd7cb4cb0031ba249f",
    createdAt: "2026-06-01T09:00:00.000Z",
    updatedAt: "2026-06-01T09:01:12.000Z",
    submittedAt: "2026-06-01T09:00:30.000Z",
    confirmedAt: "2026-06-01T09:01:12.000Z",
  },
  {
    id: "payout-002",
    userId: "user-bob",
    recipientEmail: "bob@example.com",
    amount: "25.5000000",
    asset: "native",
    memo: "Sprint bonus",
    status: "pending",
    createdAt: "2026-06-10T14:30:00.000Z",
    updatedAt: "2026-06-10T14:30:00.000Z",
  },
  {
    id: "payout-003",
    userId: "user-charlie",
    recipientEmail: "charlie@example.com",
    amount: "100.0000000",
    asset: "native",
    status: "failed",
    error: "op_no_destination",
    createdAt: "2026-06-12T11:00:00.000Z",
    updatedAt: "2026-06-12T11:00:45.000Z",
    submittedAt: "2026-06-12T11:00:40.000Z",
  },
  {
    id: "payout-004",
    userId: "user-diana",
    recipientEmail: "diana@example.com",
    amount: "10.0000000",
    asset: "native",
    memo: "Tools reimbursement",
    status: "submitted",
    transactionId: "abc123def456",
    createdAt: "2026-06-18T08:00:00.000Z",
    updatedAt: "2026-06-18T08:00:10.000Z",
    submittedAt: "2026-06-18T08:00:10.000Z",
  },
  {
    id: "payout-005",
    userId: "user-eve",
    recipientEmail: "eve@example.com",
    amount: "5.0000000",
    asset: "native",
    status: "cancelled",
    createdAt: "2026-06-15T16:00:00.000Z",
    updatedAt: "2026-06-15T16:05:00.000Z",
  },
];

// ─── Mock Stellar Accounts ────────────────────────────────────────────────────

export const mockStellarAccounts: Record<string, StellarAccount> = {
  [TEST_KEYPAIRS.accountA.publicKey]: {
    id: TEST_KEYPAIRS.accountA.publicKey,
    balance: "9948.9999900",
    sequenceNumber: "3626163567960065",
    subentryCount: 0,
  },
  [TEST_KEYPAIRS.accountB.publicKey]: {
    id: TEST_KEYPAIRS.accountB.publicKey,
    balance: "200.0000000",
    sequenceNumber: "3626163567960066",
    subentryCount: 0,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMockPayout(id: string): PayoutRequest | undefined {
  return mockPayouts.find((p) => p.id === id);
}

export function getMockPayoutsByStatus(status: PayoutRequest["status"]): PayoutRequest[] {
  return mockPayouts.filter((p) => p.status === status);
}
