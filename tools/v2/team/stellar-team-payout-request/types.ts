/**
 * Stellar Team Payout Request — Type Definitions
 *
 * All types are local to this tool. Do not import from the main app.
 */

/** Lifecycle status of a payout request. */
export type PayoutStatus = "pending" | "submitted" | "confirmed" | "failed" | "cancelled";

/** Form data submitted by the user before a PayoutRequest is created. */
export interface PayoutFormData {
  /** Valid email address of the intended recipient. */
  recipientEmail: string;
  /** Amount in XLM, stored as string to avoid floating-point drift. */
  amount: string;
  /** Optional transaction memo (max 28 bytes UTF-8). */
  memo?: string;
  /** Optional future submission date (ISO-8601). */
  scheduledFor?: string;
}

/** A persisted payout request record. */
export interface PayoutRequest {
  id: string;
  userId: string;
  recipientEmail: string;
  /** Resolved Stellar public key of the recipient, if known. */
  recipientStellarId?: string;
  /** Amount in XLM as a decimal string, e.g. "50.0000000". */
  amount: string;
  memo?: string;
  status: PayoutStatus;
  /** Stellar transaction hash once submitted. */
  transactionId?: string;
  /** Human-readable error message when status is "failed". */
  error?: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  scheduledFor?: string; // ISO-8601
  submittedAt?: string; // ISO-8601
  confirmedAt?: string; // ISO-8601
}

/** Result returned by validation helpers. */
export interface ValidationResult {
  valid: boolean;
  /** Field-keyed error messages. */
  errors: Record<string, string>;
}

/** Lightweight Stellar account info used by the tool. */
export interface StellarAccountInfo {
  id: string;
  /** XLM balance as a decimal string. */
  balance: string;
  sequenceNumber: string;
}
