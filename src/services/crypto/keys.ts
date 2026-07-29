/**
 * Least-privilege CryptoKey factories (#1692).
 *
 * Web Crypto keys carry an explicit usage list. The sealing path, for example,
 * only ever calls `encrypt`, yet content keys have historically been minted
 * with `["encrypt", "decrypt"]`. Over-broad usages weaken least-privilege
 * guarantees and turn misuse (decrypting with a key that should only seal) into
 * a silent success instead of a fast, predictable failure.
 *
 * This module centralises key creation behind explicit, single-responsibility
 * factories. Each returns a CryptoKey whose usage set is the smallest its
 * operation needs, so the runtime itself rejects any other operation with an
 * InvalidAccessError. It is self-contained (its own minimal error type, no
 * dependency on the other crypto modules) so it is independently mergeable and
 * testable, matching the conventions of the surrounding crypto services.
 *
 * ## Extractability & lifetime
 *
 * - Symmetric content/wrapping keys are imported NON-EXTRACTABLE: the raw bytes
 *   cannot be read back via `exportKey`, bounding blast radius on compromise.
 * - Signing private keys are generated NON-EXTRACTABLE; the matching
 *   verification public key is (necessarily, per Web Crypto) extractable so it
 *   can be published.
 * - All keys here are EPHEMERAL / SESSION-LIVED: mint one per message (content
 *   keys) or per session (wrapping/signing) and drop the reference when done.
 *   None of these factories persist key material.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class KeyUsageError extends Error {
  readonly code = "crypto_key_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "KeyUsageError";
  }
}

const AES_ALGORITHM = { name: "AES-GCM", length: 256 } as const;
const SIGNING_ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const AES_KEY_BYTES = 32;

/** Copy bytes into a fresh ArrayBuffer (an unconditionally valid BufferSource). */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

/** Validate and copy 256-bit symmetric key material. */
function requireAesKeyMaterial(raw: Uint8Array): ArrayBuffer {
  if (!(raw instanceof Uint8Array) || raw.length !== AES_KEY_BYTES) {
    throw new KeyUsageError(`symmetric key material must be exactly ${AES_KEY_BYTES} bytes`);
  }
  return toBuffer(raw);
}

/**
 * Content-encryption key for the SEALING path. Encrypt-only, non-extractable,
 * ephemeral (mint one per message). Attempting to decrypt with it rejects.
 */
export async function createSealingKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", requireAesKeyMaterial(raw), AES_ALGORITHM, false, [
    "encrypt",
  ]);
}

/**
 * Content-decryption key for the OPENING path. Decrypt-only, non-extractable,
 * ephemeral. Attempting to encrypt with it rejects.
 */
export async function createOpeningKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", requireAesKeyMaterial(raw), AES_ALGORITHM, false, [
    "decrypt",
  ]);
}

/**
 * Key-wrapping key. wrapKey-only, non-extractable, session-lived. Wraps a
 * content key for transport; it cannot itself encrypt message bodies.
 */
export async function createWrappingKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", requireAesKeyMaterial(raw), AES_ALGORITHM, false, [
    "wrapKey",
  ]);
}

/** Key-unwrapping key. unwrapKey-only, non-extractable, session-lived. */
export async function createUnwrappingKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", requireAesKeyMaterial(raw), AES_ALGORITHM, false, [
    "unwrapKey",
  ]);
}

/** A freshly generated signing key pair with least-privilege usages. */
export interface SigningKeyPair {
  /** ECDSA P-256 private key, sign-only, non-extractable. */
  readonly signingKey: CryptoKey;
  /** ECDSA P-256 public key, verify-only (safe to publish). */
  readonly verificationKey: CryptoKey;
}

/**
 * Generate an ECDSA P-256 signing pair. The private key can only `sign` and is
 * non-extractable; the public key can only `verify`. Session-lived.
 */
export async function createSigningKeyPair(): Promise<SigningKeyPair> {
  const pair = (await crypto.subtle.generateKey(SIGNING_ALGORITHM, false, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  return { signingKey: pair.privateKey, verificationKey: pair.publicKey };
}

/**
 * Import a distributed verification public key (SPKI DER). verify-only and
 * extractable (public material). Cannot sign.
 */
export async function createVerificationKey(spki: Uint8Array): Promise<CryptoKey> {
  if (!(spki instanceof Uint8Array) || spki.length === 0) {
    throw new KeyUsageError("verification key material must be non-empty bytes");
  }
  return crypto.subtle.importKey("spki", toBuffer(spki), SIGNING_ALGORITHM, true, ["verify"]);
}
