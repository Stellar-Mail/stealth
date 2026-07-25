/**
 * Recipient-decryptable envelope key wrapping (#1712).
 *
 * The current envelope crypto generates a fresh AES-256-GCM content-encryption
 * key for each message but never exports, wraps, or transmits that key to the
 * recipient. The ciphertext is sealed correctly, but no recipient can open it
 * because no key material is provided.
 *
 * This module adds a crypto key-wrapping layer that:
 * 1. Derives or imports the recipient's encryption public key
 * 2. Wraps the generated content-encryption key using ECDH + HKDF + AES-GCM
 * 3. Stores only the wrapped key plus required algorithm metadata in the envelope
 *
 * The implementation reuses the audited `recipient-privacy.ts` scheme (ECDH
 * P-256 + HKDF-SHA256 + AES-256-GCM) which provides:
 * - Ephemeral per-message ECDH key agreement
 * - Blinded recipient identifiers (HMAC-based, indistinguishable from random)
 * - Authenticated encryption of wrapped keys (AES-GCM)
 * - Fail-closed decryption (wrong keys fail verification)
 *
 * Security properties:
 * - The raw content key is never serialized, logged, or returned from public APIs
 * - Only recipients with matching private keys can unwrap the content key
 * - Non-recipients cannot unwrap the key (enforced by ECDH + AES-GCM auth tag)
 * - Observers cannot link blinded IDs to recipient identities
 */

import {
  createPrivacyEntry,
  locateAndDecryptEntry,
  type PrivacyPreservingRecipientEntry,
} from "./recipient-privacy";
import { fromBase64, toBase64 } from "./codec";
import { CryptoError } from "./errors";

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class KeyWrapError extends Error {
  readonly code = "crypto_key_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "KeyWrapError";
  }
}

/**
 * Wrapped key entry for a single recipient. This is the wire format stored
 * in the envelope payload.
 */
export interface WrappedKeyEntry {
  /** Base64-encoded ephemeral public key (SPKI format). */
  ephemeralPublicKey: string;
  /** Hex-encoded blinded recipient identifier. */
  blindedRecipientId: string;
  /** Base64-encoded wrapped content key. */
  wrappedKey: string;
  /** Hex-encoded nonce for AES-GCM wrapping. */
  nonce: string;
}

/**
 * Wrap a content-encryption key for a recipient's public key.
 *
 * @param contentKey The AES-256-GCM content-encryption key to wrap (must be extractable).
 * @param recipientPublicKey The recipient's P-256 ECDH public key.
 * @returns A wrapped key entry containing ephemeral public key, blinded ID, wrapped key, and nonce.
 * @throws KeyWrapError if the content key is not extractable or wrapping fails.
 */
export async function wrapContentKey(
  contentKey: CryptoKey,
  recipientPublicKey: CryptoKey,
): Promise<WrappedKeyEntry> {
  if (!contentKey.extractable) {
    throw new KeyWrapError("content key must be extractable for wrapping");
  }

  if (contentKey.type !== "secret") {
    throw new KeyWrapError("content key must be a symmetric secret key");
  }

  try {
    const entry = await createPrivacyEntry(recipientPublicKey, contentKey);
    return {
      ephemeralPublicKey: entry.ephemeralPublicKey,
      blindedRecipientId: entry.blindedRecipientId,
      wrappedKey: entry.wrappedKey,
      nonce: entry.nonce,
    };
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`key wrapping failed: ${err.message}`);
    }
    throw new KeyWrapError("key wrapping failed");
  }
}

/**
 * Wrap a content-encryption key for multiple recipients.
 *
 * @param contentKey The AES-256-GCM content-encryption key to wrap (must be extractable).
 * @param recipientPublicKeys Array of recipient P-256 ECDH public keys.
 * @returns Array of wrapped key entries, one per recipient.
 * @throws KeyWrapError if the content key is not extractable or any wrapping fails.
 */
export async function wrapContentKeyForRecipients(
  contentKey: CryptoKey,
  recipientPublicKeys: CryptoKey[],
): Promise<WrappedKeyEntry[]> {
  if (!contentKey.extractable) {
    throw new KeyWrapError("content key must be extractable for wrapping");
  }

  if (recipientPublicKeys.length === 0) {
    throw new KeyWrapError("at least one recipient public key is required");
  }

  try {
    return await Promise.all(
      recipientPublicKeys.map((publicKey) => wrapContentKey(contentKey, publicKey)),
    );
  } catch (err) {
    if (err instanceof KeyWrapError) {
      throw err;
    }
    if (err instanceof Error) {
      throw new KeyWrapError(`multi-recipient wrapping failed: ${err.message}`);
    }
    throw new KeyWrapError("multi-recipient wrapping failed");
  }
}

/**
 * Unwrap a content-encryption key from a set of wrapped key entries.
 *
 * The recipient attempts to match and decrypt each entry using their private key.
 * Only the entry intended for this recipient (matching blinded ID) will decrypt
 * successfully. Wrong keys or tampered entries fail closed.
 *
 * @param recipientPrivateKey The recipient's P-256 ECDH private key.
 * @param wrappedEntries Array of wrapped key entries from the envelope.
 * @returns The unwrapped AES-256-GCM content key, or null if no matching entry is found.
 * @throws KeyWrapError if the private key is invalid or decryption fails unexpectedly.
 */
export async function unwrapContentKey(
  recipientPrivateKey: CryptoKey,
  wrappedEntries: WrappedKeyEntry[],
): Promise<CryptoKey | null> {
  if (wrappedEntries.length === 0) {
    return null;
  }

  if (recipientPrivateKey.type !== "private") {
    throw new KeyWrapError("recipient key must be a private key");
  }

  try {
    // Convert to PrivacyPreservingRecipientEntry format
    const entries: PrivacyPreservingRecipientEntry[] = wrappedEntries.map((entry) => ({
      ephemeralPublicKey: entry.ephemeralPublicKey,
      blindedRecipientId: entry.blindedRecipientId,
      wrappedKey: entry.wrappedKey,
      nonce: entry.nonce,
    }));

    return await locateAndDecryptEntry(recipientPrivateKey, entries);
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`key unwrapping failed: ${err.message}`);
    }
    throw new KeyWrapError("key unwrapping failed");
  }
}

/**
 * Import a recipient's public key from SPKI base64 format.
 *
 * @param spkiBase64 Base64-encoded SPKI public key.
 * @returns P-256 ECDH public key suitable for wrapping.
 * @throws KeyWrapError if the key format is invalid.
 */
export async function importRecipientPublicKey(spkiBase64: string): Promise<CryptoKey> {
  try {
    const rawSpki = fromBase64(spkiBase64);
    return await crypto.subtle.importKey(
      "spki",
      rawSpki as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      [],
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`failed to import recipient public key: ${err.message}`);
    }
    throw new KeyWrapError("failed to import recipient public key");
  }
}

/**
 * Export a public key to SPKI base64 format.
 *
 * @param publicKey P-256 ECDH public key.
 * @returns Base64-encoded SPKI format.
 * @throws KeyWrapError if export fails.
 */
export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  try {
    const spki = await crypto.subtle.exportKey("spki", publicKey);
    return toBase64(new Uint8Array(spki));
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`failed to export public key: ${err.message}`);
    }
    throw new KeyWrapError("failed to export public key");
  }
}

/**
 * Import a recipient's private key from PKCS8 base64 format.
 *
 * @param pkcs8Base64 Base64-encoded PKCS8 private key.
 * @returns P-256 ECDH private key suitable for unwrapping.
 * @throws KeyWrapError if the key format is invalid.
 */
export async function importRecipientPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  try {
    const rawPkcs8 = fromBase64(pkcs8Base64);
    return await crypto.subtle.importKey(
      "pkcs8",
      rawPkcs8 as BufferSource,
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveKey", "deriveBits"],
    );
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`failed to import recipient private key: ${err.message}`);
    }
    throw new KeyWrapError("failed to import recipient private key");
  }
}

/**
 * Generate a recipient key pair for testing or initial setup.
 *
 * @returns A P-256 ECDH key pair with base64-encoded SPKI public key and PKCS8 private key.
 * @throws KeyWrapError if key generation fails.
 */
export async function generateRecipientKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeySpkiBase64: string;
  privateKeyPkcs8Base64: string;
}> {
  try {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
      "deriveKey",
      "deriveBits",
    ]);

    const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
    const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      publicKeySpkiBase64: toBase64(new Uint8Array(spki)),
      privateKeyPkcs8Base64: toBase64(new Uint8Array(pkcs8)),
    };
  } catch (err) {
    if (err instanceof Error) {
      throw new KeyWrapError(`failed to generate recipient key pair: ${err.message}`);
    }
    throw new KeyWrapError("failed to generate recipient key pair");
  }
}
