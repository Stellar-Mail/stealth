/**
 * Secure recipient key-resolution interface (#1712).
 *
 * The crypto implementation has no abstraction for locating a recipient
 * encryption public key or validating its provenance. Without identity
 * binding, key wrapping cannot be secure if arbitrary or stale recipient keys
 * are accepted.
 *
 * This module defines a resolver interface returning normalized key material
 * plus a key identifier, validity period, provenance, and revocation status,
 * all validated before use. Self-contained (local ResolverError).
 */

import { getCryptoTestVectors } from "./testing";
import { recordCryptoTelemetry, type CryptoResultCode } from "./telemetry";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class ResolverError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "ResolverError";
  }
}

/** Provenance describes how a key was obtained (never the secret itself). */
export type KeyProvenance = "trusted-directory" | "on-chain" | "cached" | "attestation";

/** Normalized, non-secret metadata about a resolved key. */
export interface ResolvedKey {
  /** The recipient this key is bound to (e.g. a Stellar address). */
  recipient: string;
  /** Encoded public key material (non-secret). */
  publicKey: Uint8Array;
  /** Stable identifier for the key (e.g. key hash or version). */
  keyId: string;
  /** ISO timestamp before which the key is not valid. */
  notBefore: string;
  /** ISO timestamp after which the key is expired. */
  notAfter: string;
  /** Whether the key has been revoked. */
  revoked: boolean;
  /** How the key was obtained. */
  provenance: KeyProvenance;
}

/** A resolver locates and returns a validated key for a recipient. */
export interface RecipientKeyResolver {
  resolve(recipient: string): Promise<ResolvedKey>;
}

function parseIso(value: string): number {
  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    throw new ResolverError(`invalid timestamp: ${value}`);
  }
  return t;
}

/**
 * Validate a resolved key: bound to the requested recipient, within its
 * validity window, not revoked, and carrying real public-key material.
 * Throws ResolverError on any failure so callers never use an unsafe key.
 */
export function validateResolvedKey(
  key: ResolvedKey,
  recipient: string,
  now: Date = getCryptoTestVectors().now ? getCryptoTestVectors().now!() : new Date(),
): ResolvedKey {
  if (key.recipient !== recipient) {
    throw new ResolverError("resolved key is not bound to the requested recipient");
  }
  if (key.revoked) {
    throw new ResolverError("resolved key has been revoked");
  }
  if (!key.publicKey || key.publicKey.length === 0) {
    throw new ResolverError("resolved key has no public key material");
  }
  const nowMs = now.getTime();
  if (nowMs < parseIso(key.notBefore)) {
    throw new ResolverError("resolved key is not yet valid");
  }
  if (nowMs > parseIso(key.notAfter)) {
    throw new ResolverError("resolved key has expired");
  }
  return key;
}

/**
 * Resolve and validate in one step. Implementations provide a resolver; this
 * guarantees the returned key is safe to use for wrapping.
 */
export async function resolveTrustedKey(
  resolver: RecipientKeyResolver,
  recipient: string,
  now: Date = getCryptoTestVectors().now ? getCryptoTestVectors().now!() : new Date(),
): Promise<ResolvedKey> {
  const startTime = performance.now();
  let result: CryptoResultCode = "success";

  try {
    const key = await resolver.resolve(recipient);
    return validateResolvedKey(key, recipient, now);
  } catch (error: unknown) {
    result = mapResolverError(error);
    throw error;
  } finally {
    const durationMs = Math.max(1, Math.round(performance.now() - startTime));
    recordCryptoTelemetry({
      operation: "key_resolve",
      result,
      durationMs,
    });
  }
}

function mapResolverError(error: unknown): CryptoResultCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === "string") {
      switch (code) {
        case "crypto_validation_error":
          return "error_validation";
        case "crypto_key_error":
          return "error_key";
      }
    }
  }
  return "error_key";
}
