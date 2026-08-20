import type { NotificationTransport } from "@/config/schema";

/**
 * BETA-005: Pluggable verification-message delivery contract.
 *
 * The signup flow must deliver a verification message without depending on a
 * third-party mail vendor. Every transport implements this single interface:
 *
 * - `sink` — local-development capture sink (messages buffered in memory).
 * - `smtp` — self-hosted SMTP delivery.
 *
 * Security invariants:
 * - Adapters receive the plaintext verification token (or a URL carrying it)
 *   ONLY to deliver it to the account owner's inbox; they never persist or
 *   log the token, and delivery receipts never echo it.
 * - `safeTargetReference` on delivery receipts is a non-secret correlation
 *   reference (e.g. a recipient hash), never the token.
 */

export interface VerificationEmailMessage {
  /** Recipient address (normalized account email). */
  to: string;
  /** Verified account purpose. */
  purpose: "email_verification" | "password_reset";
  /** Absolute URL the recipient opens to complete verification. */
  verificationUrl: string;
  /** Expiry instant of the token carried by the verification URL. */
  expiresAt: Date;
}

export interface DeliveryReceipt {
  transport: NotificationTransport;
  /** Whether the transport accepted the message for delivery. */
  accepted: boolean;
  /** Non-secret provider reference (sink sequence id, SMTP message id). */
  providerRef?: string;
  /** Non-secret correlation reference; never the plaintext token. */
  safeTargetReference: string;
}

export interface NotificationAdapter {
  readonly transport: NotificationTransport;
  deliverVerificationEmail(message: VerificationEmailMessage): Promise<DeliveryReceipt>;
}

export type { NotificationTransport };
