/**
 * Secure recipient key-resolution interface (#1712, #1934 BETA-027).
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
import { fromBase64, fromHex } from "./codec";

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
  /** ISO timestamp when the key was revoked (if revoked). */
  revokedAt?: string | null;
  /** How the key was obtained. */
  provenance: KeyProvenance;
  /** Key version in directory lifecycle. */
  version?: number;
}

/** A resolver locates and returns a validated key for a recipient. */
export interface RecipientKeyResolver {
  resolve(recipient: string): Promise<ResolvedKey>;
}

/** Resolves historical keys for decrypting or verifying older messages. */
export interface HistoricalKeyResolver {
  resolveHistorical(recipient: string, keyId: string, timestamp?: Date): Promise<ResolvedKey>;
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
 * Validates a key for historical message verification.
 * - Active / Rotated / Retired keys are valid if messageTimestamp was within [notBefore, notAfter].
 * - Revoked keys are permitted ONLY if messageTimestamp is strictly BEFORE revokedAt.
 */
export function validateHistoricalKey(
  key: ResolvedKey,
  recipient: string,
  messageTimestamp: Date | string,
): ResolvedKey {
  if (key.recipient !== recipient) {
    throw new ResolverError("resolved key is not bound to the requested recipient");
  }
  if (!key.publicKey || key.publicKey.length === 0) {
    throw new ResolverError("resolved key has no public key material");
  }

  const msgMs =
    typeof messageTimestamp === "string" ? parseIso(messageTimestamp) : messageTimestamp.getTime();
  const notBeforeMs = parseIso(key.notBefore);
  const notAfterMs = parseIso(key.notAfter);

  if (msgMs < notBeforeMs || msgMs > notAfterMs) {
    throw new ResolverError("message timestamp is outside key validity window");
  }

  if (key.revoked) {
    if (!key.revokedAt) {
      throw new ResolverError("revoked key is missing revocation timestamp");
    }
    const revokedMs = parseIso(key.revokedAt);
    if (msgMs >= revokedMs) {
      throw new ResolverError("message timestamp postdates key revocation");
    }
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

/**
 * Concrete Key Directory Resolver bridging to the versioned public key directory.
 */
export class DirectoryRecipientKeyResolver implements RecipientKeyResolver, HistoricalKeyResolver {
  constructor(
    private readonly directoryFetcher: (owner: string) => Promise<{
      currentKeys: { encryption?: any; signing?: any };
      historicalKeys: any[];
      allKeys: any[];
    } | null>,
  ) {}

  public async resolve(recipient: string): Promise<ResolvedKey> {
    const dir = await this.directoryFetcher(recipient);
    if (!dir || !dir.currentKeys?.encryption) {
      throw new ResolverError(`No active encryption key found for recipient ${recipient}`);
    }

    const currentKey = dir.currentKeys.encryption;
    return this.toResolvedKey(currentKey, recipient);
  }

  public async resolveHistorical(
    recipient: string,
    keyId: string,
    timestamp?: Date,
  ): Promise<ResolvedKey> {
    const dir = await this.directoryFetcher(recipient);
    if (!dir) {
      throw new ResolverError(`Key directory not found for recipient ${recipient}`);
    }

    const key = dir.allKeys.find((k: any) => k.keyId === keyId);
    if (!key) {
      throw new ResolverError(`Key ${keyId} not found in directory for recipient ${recipient}`);
    }

    const resolved = this.toResolvedKey(key, recipient);
    if (timestamp) {
      return validateHistoricalKey(resolved, recipient, timestamp);
    }
    return resolved;
  }

  private toResolvedKey(rawKey: any, recipient: string): ResolvedKey {
    let pubKeyBytes: Uint8Array;
    if (typeof rawKey.publicKey === "string") {
      try {
        if (/^[0-9a-fA-F]+$/.test(rawKey.publicKey)) {
          pubKeyBytes = fromHex(rawKey.publicKey);
        } else {
          pubKeyBytes = fromBase64(rawKey.publicKey);
        }
      } catch {
        pubKeyBytes = new TextEncoder().encode(rawKey.publicKey);
      }
    } else {
      pubKeyBytes = rawKey.publicKey;
    }

    return {
      recipient,
      publicKey: pubKeyBytes,
      keyId: rawKey.keyId,
      notBefore: rawKey.notBefore,
      notAfter: rawKey.notAfter,
      revoked: rawKey.status === "revoked",
      revokedAt: rawKey.revokedAt ?? null,
      provenance: "trusted-directory",
      version: rawKey.version,
    };
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
