/**
 * Key revocation status tracking and enforcement.
 *
 * Implements revocation checks for both recipient keys (during sealing) and
 * signer keys (during verification). Revocation decisions respect an injected
 * clock for testability and timestamp-based policy enforcement.
 *
 * This module does NOT perform key resolution itself; it consumes revocation
 * metadata from the caller's trusted key resolution layer.
 */

import { CryptoError } from "./errors";

/**
 * Revocation status for a cryptographic key.
 */
export interface RevocationStatus {
  /** Whether the key is currently revoked. */
  revoked: boolean;
  /** ISO 8601 timestamp when revocation became effective (if revoked). */
  revokedAt?: string;
  /** Human-readable reason for revocation (optional, for audit/logging). */
  reason?: string;
}

/**
 * Minimal key metadata needed for revocation enforcement.
 */
export interface KeyWithRevocation {
  /** Key identifier (e.g., public key fingerprint or address). */
  keyId: string;
  /** Current revocation status of this key. */
  revocation: RevocationStatus;
}

/**
 * Timestamp policy for signature verification.
 * Determines whether to check revocation at signing time or verification time.
 */
export type TimestampPolicy = "signing-time" | "verification-time";

/**
 * Clock abstraction for testability. Production uses real Date.now(),
 * tests can inject a frozen or controllable clock.
 */
export interface Clock {
  now(): Date;
}

export const SYSTEM_CLOCK: Clock = {
  now: () => new Date(),
};

/**
 * Options for revocation enforcement during sealing (encryption).
 */
export interface SealRevocationOptions {
  /** Clock implementation for determining "now". Defaults to system clock. */
  clock?: Clock;
  /** Whether to fail if revocation metadata is missing. Defaults to true. */
  requireRevocationData?: boolean;
}

/**
 * Options for revocation enforcement during verification (decryption/signing).
 */
export interface VerifyRevocationOptions {
  /** Clock implementation for determining "now". Defaults to system clock. */
  clock?: Clock;
  /** Timestamp policy: when to check revocation. Defaults to "verification-time". */
  timestampPolicy?: TimestampPolicy;
  /** The signing timestamp (ISO 8601) if using "signing-time" policy. */
  signedAt?: string;
  /** Whether to fail if revocation metadata is missing. Defaults to true. */
  requireRevocationData?: boolean;
}

/**
 * Check if a recipient key is eligible for use in a new envelope.
 * Throws CryptoError with code "crypto_key_error" if the key is revoked.
 *
 * @param recipient - The recipient key with revocation metadata
 * @param options - Optional enforcement configuration
 * @throws {CryptoError} If the recipient key is revoked or revocation data is missing
 */
export function enforceRecipientNotRevoked(
  recipient: KeyWithRevocation,
  options: SealRevocationOptions = {},
): void {
  const { requireRevocationData = true } = options;

  // If revocation metadata is missing entirely, enforce based on policy
  if (recipient.revocation === undefined || recipient.revocation === null) {
    if (requireRevocationData) {
      throw new CryptoError(
        "crypto_key_error",
        `Recipient key ${sanitizeKeyId(recipient.keyId)} has no revocation metadata`,
      );
    }
    // If not required, allow (opt-in to relaxed mode for testing/demo)
    return;
  }

  if (recipient.revocation.revoked) {
    throw new CryptoError(
      "crypto_key_error",
      `Recipient key ${sanitizeKeyId(recipient.keyId)} is revoked`,
    );
  }
}

/**
 * Check if a signer key is eligible for verification according to timestamp policy.
 * Throws CryptoError with code "crypto_signature_error" if the key was revoked
 * at the relevant point in time.
 *
 * @param signer - The signer key with revocation metadata
 * @param options - Verification configuration including timestamp policy
 * @throws {CryptoError} If the signer key was revoked at the policy-relevant time
 */
export function enforceSignerNotRevoked(
  signer: KeyWithRevocation,
  options: VerifyRevocationOptions = {},
): void {
  const {
    clock = SYSTEM_CLOCK,
    timestampPolicy = "verification-time",
    signedAt,
    requireRevocationData = true,
  } = options;

  // If revocation metadata is missing entirely, enforce based on policy
  if (signer.revocation === undefined || signer.revocation === null) {
    if (requireRevocationData) {
      throw new CryptoError(
        "crypto_signature_error",
        `Signer key ${sanitizeKeyId(signer.keyId)} has no revocation metadata`,
      );
    }
    // If not required, allow (opt-in to relaxed mode for testing/demo)
    return;
  }

  if (!signer.revocation.revoked) {
    // Key is not revoked, always valid
    return;
  }

  // Key is revoked; determine the relevant timestamp for comparison
  const relevantTime =
    timestampPolicy === "signing-time" && signedAt ? new Date(signedAt) : clock.now();

  const revokedAt = signer.revocation.revokedAt
    ? new Date(signer.revocation.revokedAt)
    : new Date(0); // If no timestamp, assume revoked from epoch (always invalid)

  if (relevantTime >= revokedAt) {
    throw new CryptoError(
      "crypto_signature_error",
      `Signer key ${sanitizeKeyId(signer.keyId)} was revoked at ${signer.revocation.revokedAt}`,
    );
  }

  // Signature was created before revocation became effective, allow it
}

/**
 * Batch check for multiple recipient keys.
 * Returns the subset of keys that are NOT revoked (safe to use).
 * Throws if any key fails revocation check and failFast is true.
 *
 * @param recipients - Array of recipient keys to check
 * @param options - Enforcement configuration
 * @returns Array of non-revoked recipient keys
 * @throws {CryptoError} If failFast is true and any key is revoked
 */
export function filterRevokedRecipients(
  recipients: KeyWithRevocation[],
  options: SealRevocationOptions & { failFast?: boolean } = {},
): KeyWithRevocation[] {
  const { failFast = false } = options;
  const valid: KeyWithRevocation[] = [];

  for (const recipient of recipients) {
    try {
      enforceRecipientNotRevoked(recipient, options);
      valid.push(recipient);
    } catch (error) {
      if (failFast) {
        throw error;
      }
      // Continue to next key; this one is revoked
    }
  }

  return valid;
}

/**
 * Sanitize key identifier for error messages to prevent leaking full key material.
 * Shows only the first 8 characters of the key ID.
 */
function sanitizeKeyId(keyId: string): string {
  if (!keyId || keyId.length === 0) {
    return "[empty-key-id]";
  }
  if (keyId.length <= 8) {
    return keyId;
  }
  return `${keyId.slice(0, 8)}...`;
}

/**
 * Create a non-revoked key metadata object for use in tests or demo scenarios.
 */
export function createActiveKey(keyId: string): KeyWithRevocation {
  return {
    keyId,
    revocation: {
      revoked: false,
    },
  };
}

/**
 * Create a revoked key metadata object for use in tests or demo scenarios.
 */
export function createRevokedKey(
  keyId: string,
  revokedAt: string,
  reason?: string,
): KeyWithRevocation {
  return {
    keyId,
    revocation: {
      revoked: true,
      revokedAt,
      reason,
    },
  };
}
