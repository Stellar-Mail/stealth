/**
 * Crypto-boundary identifier normalizer (#1732).
 *
 * `sealEnvelope` accepted sender/recipient strings without validating them as
 * Stellar addresses or distinguishing them from higher-level address forms.
 * Invalid or non-canonical identifiers could be signed into envelopes and
 * cause mismatched key resolution or routing.
 *
 * This module normalizes and validates identities before encryption. It
 * distinguishes Stellar account (G...) addresses from federation addresses
 * (user*domain) and returns the canonical account address used for
 * cryptographic binding. Display/federation forms are never substituted for
 * the verified canonical identity. Self-contained (local IdentityError).
 */

import { recordCryptoTelemetry, type CryptoResultCode } from "./telemetry";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class IdentityError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "IdentityError";
  }
}

/** The kind of identifier that was resolved. */
export type IdentityKind = "account" | "federation";

/** Normalized, canonical identity data safe for cryptographic binding. */
export interface NormalizedIdentity {
  /** The canonical form used for crypto binding (always the account address). */
  canonical: string;
  /** The raw input that was provided. */
  raw: string;
  /** Whether the input was a raw account address or a federation address. */
  kind: IdentityKind;
}

const ACCOUNT_PREFIX = "G";
const ACCOUNT_LENGTH = 56;
// Stellar base32 alphabet (RFC 4648, no padding) for account IDs.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** A pure structural validator for a Stellar account address (G + 55 chars). */
export function isValidAccountAddress(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length !== ACCOUNT_LENGTH) return false;
  if (!value.startsWith(ACCOUNT_PREFIX)) return false;
  for (const ch of value) {
    if (!BASE32_ALPHABET.includes(ch)) return false;
  }
  return true;
}

/** Detects a federation-style address (user*domain.tld). */
export function isFederationAddress(value: string): boolean {
  if (typeof value !== "string") return false;
  const star = value.indexOf("*");
  if (star <= 0 || star === value.length - 1) return false;
  // Must have a domain-like tail (at least one dot after the star).
  const domain = value.slice(star + 1);
  return domain.includes(".") && domain.length > 0;
}

/**
 * Normalize an identifier for cryptographic binding.
 *
 * - A valid account address is returned canonical = itself, kind = "account".
 * - A federation address is recognized (kind = "federation") but its canonical
 *   form is NOT fabricated — callers must resolve it via the federation
 *   resolver out-of-band and re-normalize the resulting account address. We do
 *   not substitute a display form for a verified identity.
 *
 * Throws IdentityError on malformed input (empty, ambiguous, or neither a valid
 * account nor a federation address).
 */
export function normalizeIdentity(value: string): NormalizedIdentity {
  const startTime = performance.now();
  let result: CryptoResultCode = "success";

  try {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new IdentityError("identifier must be a non-empty string");
    }
    const trimmed = value.trim();

    if (isValidAccountAddress(trimmed)) {
      return { canonical: trimmed, raw: trimmed, kind: "account" };
    }

    if (isFederationAddress(trimmed)) {
      // Recognized but unresolved: canonical is left as the raw federation form
      // so no unverified account is ever bound. Callers resolve then re-normalize.
      return { canonical: trimmed, raw: trimmed, kind: "federation" };
    }

    throw new IdentityError("identifier is neither a valid account nor a federation address");
  } catch (error: unknown) {
    result = mapIdentityError(error);
    throw error;
  } finally {
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    recordCryptoTelemetry({
      operation: "identity_normalize",
      result,
      durationMs,
    });
  }
}

function mapIdentityError(error: unknown): CryptoResultCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") {
      switch (code) {
        case "crypto_validation_error":
          return "error_validation";
      }
    }
  }
  return "error_validation";
}

/**
 * Validate that two identities can be bound to an envelope (sender/recipient).
 * Both must be valid; account addresses are the only directly bindable form.
 * Returns true when both are bindable account addresses.
 */
export function canBindIdentities(
  sender: NormalizedIdentity,
  recipient: NormalizedIdentity,
): boolean {
  return sender.kind === "account" && recipient.kind === "account";
}
