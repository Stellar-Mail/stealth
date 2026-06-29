/**
 * Stellar Team Payout Request - Type Definitions
 *
 * All types are local to this tool. Do not import into the main app,
 * wallet core, or Stellar integration unless a future integration issue
 * explicitly allows it.
 */

// ─── Status Enums ─────────────────────────────────────────────────────────────

export type PayoutStatus = "pending" | "submitted" | "confirmed" | "failed" | "cancelled";

export type StellarAsset = "native" | string; // 'native' = XLM

// ─── Core Domain Types ────────────────────────────────────────────────────────

/**
 * A payout request created by a team member.
 */
export interface PayoutRequest {
  id: string;
  userId: string;
  recipientEmail: string;
  recipientStellarId?: string;
  /** Amount in XLM, stored as string to preserve decimal precision */
  amount: string;
  asset: StellarAsset;
  memo?: string;
  status: PayoutStatus;
  transactionId?: string;
  error?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  scheduledFor?: string; // ISO 8601
  submittedAt?: string; // ISO 8601
  confirmedAt?: string; // ISO 8601
}

/**
 * Data submitted via the payout form.
 */
export interface PayoutFormData {
  recipientEmail: string;
  amount: string;
  memo?: string;
  scheduledFor?: Date;
}

/**
 * Validation result for a payout request.
 */
export interface PayoutValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PayoutFormData, string>>;
}

// ─── Stellar Account Types ────────────────────────────────────────────────────

export interface StellarAccount {
  id: string;
  /** XLM balance as string */
  balance: string;
  sequenceNumber: string;
  subentryCount: number;
}

export interface StellarTransaction {
  id: string;
  sourceAccount: string;
  destinationAccount: string;
  amount: string;
  asset: StellarAsset;
  memo?: string;
  /** Fee in stroops (1 XLM = 10^7 stroops) */
  fee: string;
  ledger: number;
  createdAt: string;
}

export interface TransactionResult {
  id: string;
  status: "success" | "failure";
  ledger: number;
  timestamp: string;
  error?: string;
}

export interface TransactionStatus {
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
  error?: string;
}

// ─── Error Types ──────────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(public readonly errors: Partial<Record<string, string>>) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

export class StellarNetworkError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "StellarNetworkError";
  }
}
