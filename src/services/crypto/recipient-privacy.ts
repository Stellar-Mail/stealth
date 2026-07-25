/**
 * RECIPIENT PRIVACY THREAT MODEL & COMPATIBILITY DOCUMENTATION
 *
 * Threat Model:
 * 1. Social/Organizational Metadata Leakage:
 *    - In traditional multi-recipient envelopes, the identities/addresses of all recipients
 *      are visible in plaintext. Unrelated observers (e.g., relay nodes, network eavesdroppers)
 *      can map communication graphs and organizational structures.
 *    - Mitigation: This module replaces plaintext recipient identifiers with blinded recipient
 *      identifiers (`blindedRecipientId`) derived from an ECDH-derived shared secret. Observers
 *      cannot link the blinded ID to any specific identity without possessing either the sender's
 *      ephemeral private key or the recipient's private key.
 * 2. Active Enumeration / Dictionary Attack:
 *    - If blinded IDs were derived via simple hashing (e.g. `SHA256(recipient_address)`), an observer
 *      could precompute hashes for all potential recipients (dictionary attack).
 *    - Mitigation: Blinded IDs are derived dynamically using a per-recipient ECDH key agreement.
 *      The resulting shared secret serves as the key for HKDF-expand, making the blinded ID
 *      indistinguishable from random noise to anyone without the private keys.
 * 3. Collision and False-Match Handling:
 *    - Since blinded IDs are derived using cryptographically strong functions, the probability
 *      of a 256-bit collision between unrelated keys is < 1 in 2^128 (negligible).
 *    - In the case of intentional or accidental false-matches:
 *      - The recipient first filters entries by checking `blindedRecipientId`.
 *      - If a matching ID is found, the recipient attempts AES-256-GCM decryption of `wrappedKey`.
 *      - Authenticated decryption (AES-GCM tag verification) will fail for incorrect keys,
 *        guaranteeing that false matches fail closed safely without exposing or accepting incorrect key material.
 *
 * Compatibility:
 * - Uses standard W3C Web Cryptography API (`crypto.subtle`), supported natively in all modern
 *   browsers and Node.js (16+).
 * - Utilizes standard P-256 ECDH for key agreement, HKDF-SHA256 for key derivation, and AES-256-GCM
 *   for authenticated key wrapping.
 */

import { CryptoError } from "./errors";
import { toHex, fromHex, toBase64, fromBase64 } from "./codec";

/**
 * A privacy-preserving entry in an envelope's recipient list.
 */
export interface PrivacyPreservingRecipientEntry {
  /** Base64-encoded ephemeral public key of the sender for this recipient (SPKI format). */
  ephemeralPublicKey: string;
  /** Hex-encoded blinded recipient identifier. */
  blindedRecipientId: string;
  /** Base64-encoded encrypted content-encryption key. */
  wrappedKey: string;
  /** Hex-encoded nonce used for AES-GCM wrapping. */
  nonce: string;
}

const HKDF_INFO = new TextEncoder().encode("stealth-recipient-privacy-v1");

/**
 * Helper to import a P-256 SPKI public key.
 */
async function importPublicKey(spkiBase64: string): Promise<CryptoKey> {
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
    throw new CryptoError("crypto_key_error", "Failed to import public key");
  }
}

/**
 * Helper to export a public key to SPKI base64 format.
 */
async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return toBase64(new Uint8Array(exported));
}

/**
 * Generates a standard P-256 ECDH keypair.
 */
export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

/**
 * Create a privacy-preserving recipient entry for a given recipient.
 *
 * @param recipientPublicKey The recipient's P-256 public key.
 * @param contentKey The symmetric content key (AES-256-GCM) to wrap.
 * @returns The privacy-preserving recipient entry.
 */
export async function createPrivacyEntry(
  recipientPublicKey: CryptoKey,
  contentKey: CryptoKey,
): Promise<PrivacyPreservingRecipientEntry> {
  // 1. Generate an ephemeral P-256 keypair for ECDH
  const ephemeralKeyPair = await generateEcdhKeyPair();

  // 2. Perform ECDH to derive a shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: recipientPublicKey,
    },
    ephemeralKeyPair.privateKey,
    256,
  );
  const sharedSecretBytes = new Uint8Array(sharedBits);

  // 3. Derive matching and wrapping keys via HKDF-SHA256
  // Extract
  const prk = await crypto.subtle.importKey(
    "raw",
    sharedSecretBytes as BufferSource,
    { name: "HKDF" },
    false,
    ["deriveKey"],
  );

  // Expand to get a 256-bit AES-GCM wrapping key
  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: HKDF_INFO,
    },
    prk,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );

  // Derive matching key bytes to compute blinded ID
  const matchingPrk = await crypto.subtle.importKey(
    "raw",
    sharedSecretBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const blindedIdBytes = await crypto.subtle.sign("HMAC", matchingPrk, HKDF_INFO);

  // 4. Wrap the content key
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const rawContentKey = await crypto.subtle.exportKey("raw", contentKey);
  const wrappedBytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource },
    wrappingKey,
    rawContentKey,
  );

  return {
    ephemeralPublicKey: await exportPublicKey(ephemeralKeyPair.publicKey),
    blindedRecipientId: toHex(new Uint8Array(blindedIdBytes)),
    wrappedKey: toBase64(new Uint8Array(wrappedBytes)),
    nonce: toHex(nonce),
  };
}

/**
 * Locate and decrypt the recipient's privacy entry from a list of entries.
 * Returns the decrypted content key if a matching entry is found and successfully decrypted,
 * otherwise returns null.
 *
 * @param recipientPrivateKey The recipient's private key.
 * @param entries The list of privacy-preserving entries.
 * @returns The decrypted content key, or null if no entry matches.
 */
export async function locateAndDecryptEntry(
  recipientPrivateKey: CryptoKey,
  entries: PrivacyPreservingRecipientEntry[],
): Promise<CryptoKey | null> {
  for (const entry of entries) {
    try {
      const ephemeralKey = await importPublicKey(entry.ephemeralPublicKey);

      // Perform ECDH
      const sharedBits = await crypto.subtle.deriveBits(
        {
          name: "ECDH",
          public: ephemeralKey,
        },
        recipientPrivateKey,
        256,
      );
      const sharedSecretBytes = new Uint8Array(sharedBits);

      // Verify blinded ID
      const matchingPrk = await crypto.subtle.importKey(
        "raw",
        sharedSecretBytes as BufferSource,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const expectedIdBytes = await crypto.subtle.sign("HMAC", matchingPrk, HKDF_INFO);
      const expectedId = toHex(new Uint8Array(expectedIdBytes));

      if (expectedId !== entry.blindedRecipientId) {
        continue; // Not our entry, move to next
      }

      // Found a match! Attempt decryption.
      const prk = await crypto.subtle.importKey(
        "raw",
        sharedSecretBytes as BufferSource,
        { name: "HKDF" },
        false,
        ["deriveKey"],
      );

      const wrappingKey = await crypto.subtle.deriveKey(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new Uint8Array(0),
          info: HKDF_INFO,
        },
        prk,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );

      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromHex(entry.nonce) as BufferSource },
        wrappingKey,
        fromBase64(entry.wrappedKey) as BufferSource,
      );

      // Import the decrypted raw key back as a CryptoKey
      return await crypto.subtle.importKey(
        "raw",
        decrypted,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"],
      );
    } catch (err) {
      // In case of any validation or decryption failure (e.g. false-match or corruption),
      // we fail closed and continue search.
      continue;
    }
  }

  return null;
}
