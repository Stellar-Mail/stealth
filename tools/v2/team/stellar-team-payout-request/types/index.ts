/**
 * Stellar Team Payout Request — Type Definitions
 *
 * Self-contained types for this tool. Do not re-export or import these
 * into the main app until a future integration issue explicitly allows it.
 */

export type PayoutStatus = "pending" | "submitted" | "confirmed" | "failed" | "cancelled";
export type PayoutPriority = "low" | "normal" | "high" | "urgent";
export type StellarNetwork = "testnet" | "mainnet";

export interface PayoutRecipient {
  /** Display name (may be an alias or real name) */
  name: string;
  /** Stellar account ID (G…) */
  stellarAddress: string;
  /** Optional email for notification */
  email?: string;
}

export interface PayoutRequest {
  id: string;
  recipient: PayoutRecipient;
  /** Amount in XLM (stroops stored as number for display) */
  amount: number;
  currency: string;
  description: string;
  requestedBy: string;
  requestedAt: Date;
  /** Optional deadline for processing */
  deadline?: Date;
  priority: PayoutPriority;
  status: PayoutStatus;
  /** Optional transaction memo (max 28 bytes) */
  memo?: string;
  /** Stellar transaction hash once submitted */
  transactionHash?: string;
  notes?: string;
  network: StellarNetwork;
}

export interface PayoutFormValues {
  recipientName: string;
  recipientStellarAddress: string;
  recipientEmail?: string;
  amount: string;
  description: string;
  memo?: string;
  priority: PayoutPriority;
  network: StellarNetwork;
}

export interface PayoutValidationError {
  field: keyof PayoutFormValues;
  message: string;
}
