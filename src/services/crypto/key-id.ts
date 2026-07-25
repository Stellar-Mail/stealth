/**
 * Cryptographic key identifiers and rotation metadata.
 *
 * Implements deterministic derivation of collision-resistant key identifiers (Key IDs)
 * and defines versioned key metadata for tracking rotation and revocation states.
 */

import { CryptoError } from "./errors";

/**
 * Key metadata tracking version, creation/expiry timestamps, and rotation state.
 */
export interface KeyMetadata {
  /** Deterministic, collision-resistant identifier derived from the public key. */
  keyId: string;
  /** Cryptographic algorithm name (e.g. "Ed25519", "AES-256-GCM"). */
  algorithm: string;
  /** Version of the key, incremented upon rotation. */
  version: number;
  /** ISO 8601 timestamp representing the time of key creation/issuance. */
  createdAt: string;
  /** Optional ISO 8601 timestamp representing key expiration. */
  expiresAt?: string;
  /** Current state of the key in its lifecycle. */
  rotationState: "active" | "rotated" | "revoked";
}

/**
 * Policy defining which keys are eligible for decryption.
 */
export interface KeyRotationPolicy {
  /** If false, only "active" keys can be used for decryption. */
  allowRotatedKeys: boolean;
  /** Optional grace period in seconds after expiration during which a key remains decryptable. */
  gracePeriodSeconds?: number;
  /** If true, expired keys can still decrypt envelopes (ignoring expiresAt). */
  allowExpiredKeysForDecryption?: boolean;
}

/**
 * Derives a deterministic, collision-resistant key identifier from a public key.
 *
 * Scheme:
 * 1. Compute SHA-256 hash of the public key bytes.
 * 2. Format the hash as a lowercase hex string.
 * 3. Prefix with "kid_".
 *
 * @param publicKey The public key bytes (non-secret).
 * @returns A promise resolving to the key identifier.
 */
export async function deriveKeyId(publicKey: Uint8Array): Promise<string> {
  if (!publicKey || publicKey.length === 0) {
    throw new CryptoError("crypto_key_error", "Public key bytes cannot be empty");
  }

  const hashBuffer = await crypto.subtle.digest("SHA-256", publicKey as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `kid_${hex}`;
}

/**
 * Validates whether a key can be used for decryption according to the rotation policy.
 *
 * @param key The key metadata to evaluate.
 * @param policy The rotation policy to enforce.
 * @param referenceTime The reference time to check expiration against (defaults to now).
 * @returns True if the key is decryptable, false otherwise.
 */
export function isKeyDecryptable(
  key: KeyMetadata,
  policy: KeyRotationPolicy,
  referenceTime: Date = new Date(),
): boolean {
  if (key.rotationState === "revoked") {
    return false;
  }

  if (key.rotationState === "rotated" && !policy.allowRotatedKeys) {
    return false;
  }

  if (key.expiresAt && !policy.allowExpiredKeysForDecryption) {
    const expiresTime = Date.parse(key.expiresAt);
    if (Number.isNaN(expiresTime)) {
      return false; // Safely fail closed on malformed dates.
    }
    const refMs = referenceTime.getTime();
    if (refMs > expiresTime) {
      if (policy.gracePeriodSeconds !== undefined) {
        const graceMs = policy.gracePeriodSeconds * 1000;
        if (refMs > expiresTime + graceMs) {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  return true;
}

/**
 * Resolves all eligible keys matching a given Key ID from a set of keys,
 * enforcing the rotation policy.
 *
 * @param keyId The target key identifier.
 * @param keys A pool of available keys.
 * @param policy The rotation policy to filter by.
 * @param referenceTime The reference time to check expiration against.
 * @returns A filtered list of decryptable keys matching the Key ID.
 */
export function resolveKeysFromSet(
  keyId: string,
  keys: KeyMetadata[],
  policy: KeyRotationPolicy,
  referenceTime: Date = new Date(),
): KeyMetadata[] {
  return keys.filter((k) => k.keyId === keyId && isKeyDecryptable(k, policy, referenceTime));
}

/**
 * Sorts and selects the best/primary key from a candidate list (e.g. in case of collision).
 *
 * Precedence rules:
 * 1. "active" keys take precedence over "rotated" keys.
 * 2. Higher version number takes precedence.
 * 3. Newer creation time takes precedence.
 *
 * @param keys Candidates matching the criteria.
 * @returns The best matching key, or undefined if the list is empty.
 */
export function selectBestKey(keys: KeyMetadata[]): KeyMetadata | undefined {
  if (keys.length === 0) {
    return undefined;
  }

  return [...keys].sort((a, b) => {
    // 1. Rotation state (active first)
    if (a.rotationState === "active" && b.rotationState !== "active") return -1;
    if (a.rotationState !== "active" && b.rotationState === "active") return 1;

    // 2. Version (higher first)
    if (b.version !== a.version) {
      return b.version - a.version;
    }

    // 3. Created time (newer first)
    const timeA = Date.parse(a.createdAt);
    const timeB = Date.parse(b.createdAt);
    const validA = !Number.isNaN(timeA);
    const validB = !Number.isNaN(timeB);

    if (validA && validB) {
      return timeB - timeA;
    }
    if (validA) return -1;
    if (validB) return 1;

    return 0;
  })[0];
}
