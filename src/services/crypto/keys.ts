/**
 * Least-privilege CryptoKey factories (#1692).
 *
 * `sealEnvelope` generated its AES-256-GCM content key with both `encrypt` and
 * `decrypt` usages even though the sealing path only ever encrypts. Over-broad
 * `CryptoKey.usages` weaken least-privilege guarantees and make misuse harder
 * to detect.
 *
 * This module centralizes key creation behind explicit, single-purpose
 * factories, each granting the SMALLEST valid Web Crypto usage set for one
 * operation: sealing, opening, wrapping, unwrapping, signing, and verifying.
 * Web Crypto enforces `usages` at the operation boundary, so a key minted for
 * one purpose fails closed (throws) if it is misused for another. Each factory
 * documents its extractability and expected lifetime.
 *
 * Adoption note: `sealEnvelope` should pass `SEAL_CONTENT_KEY_USAGES` when it
 * generates the body key so the seal path holds an encrypt-only key. Wiring the
 * seal/open paths onto these factories is a safe, mechanical follow-up.
 *
 * Self-contained (local `KeyError`, no cross-module imports) so the module is
 * independently mergeable, matching the rest of this folder.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class KeyError extends Error {
  readonly code = "crypto_key_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "KeyError";
  }
}

/** AES-256 content-key size. */
const AES_KEY_LENGTH_BITS = 256;
const AES_KEY_LENGTH_BYTES = 32;

/**
 * The smallest Web Crypto usage set required for each operation. Every list
 * contains exactly the usages needed to perform that one operation, no more.
 */
export const KEY_USAGES = {
  /** Seal (encrypt) an outbound body/attachment. */
  seal: ["encrypt"],
  /** Open (decrypt) an inbound body/attachment. */
  open: ["decrypt"],
  /** Wrap (encrypt) a content key for a recipient. */
  wrap: ["wrapKey"],
  /** Unwrap (decrypt) a wrapped content key. */
  unwrap: ["unwrapKey"],
  /** Produce a signature / auth tag. */
  sign: ["sign"],
  /** Verify a signature / auth tag. */
  verify: ["verify"],
} as const satisfies Record<string, readonly KeyUsage[]>;

/** Encrypt-only usages for the seal path (import into `sealEnvelope`). */
export const SEAL_CONTENT_KEY_USAGES: KeyUsage[] = [...KEY_USAGES.seal];
/** Decrypt-only usages for the open path. */
export const OPEN_CONTENT_KEY_USAGES: KeyUsage[] = [...KEY_USAGES.open];

/** Copy into a fresh ArrayBuffer-backed view (satisfies Web Crypto BufferSource). */
function copyBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(new ArrayBuffer(bytes.length));
  out.set(bytes);
  return out;
}

function assertAesKeyLength(bytes: Uint8Array): void {
  if (bytes.length !== AES_KEY_LENGTH_BYTES) {
    throw new KeyError(`AES key material must be exactly ${AES_KEY_LENGTH_BYTES} bytes`);
  }
}

/**
 * Assert that `key` carries EXACTLY `expected` (order-independent). Lets callers
 * fail closed with a stable, non-secret error before attempting an operation,
 * in addition to Web Crypto's own enforcement.
 */
export function assertKeyUsages(key: CryptoKey, expected: KeyUsage[]): void {
  const actual = [...key.usages].sort();
  const want = [...expected].sort();
  const matches = actual.length === want.length && actual.every((usage, i) => usage === want[i]);
  if (!matches) {
    throw new KeyError("key usages do not match the required least-privilege set");
  }
}

/**
 * Fresh AES-256-GCM content key for the SEAL path.
 *
 * - Usages: `["encrypt"]` - the seal path never decrypts.
 * - Extractable: `true` - the content key must be exportable so it can later be
 *   wrapped to each recipient. Callers must wrap then discard it; never persist
 *   it in the clear.
 * - Lifetime: one message; discard after sealing (and wrapping).
 */
export function generateSealContentKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH_BITS },
    true,
    SEAL_CONTENT_KEY_USAGES,
  );
}

/**
 * Import a raw 32-byte AES-256-GCM content key for the OPEN path.
 *
 * - Usages: `["decrypt"]` - the open path never encrypts.
 * - Extractable: `false` - an imported decryption key never needs re-export.
 * - Lifetime: one message; let it go out of scope after opening.
 */
export function importOpenContentKey(raw: Uint8Array): Promise<CryptoKey> {
  assertAesKeyLength(raw);
  return crypto.subtle.importKey(
    "raw",
    copyBytes(raw),
    { name: "AES-GCM" },
    false,
    OPEN_CONTENT_KEY_USAGES,
  );
}

/**
 * Import a raw 32-byte AES-KW key that may ONLY wrap other keys.
 *
 * - Usages: `["wrapKey"]`. Extractable: `false`. Lifetime: per wrapping session.
 */
export function importKeyWrappingKey(raw: Uint8Array): Promise<CryptoKey> {
  assertAesKeyLength(raw);
  return crypto.subtle.importKey(
    "raw",
    copyBytes(raw),
    { name: "AES-KW" },
    false,
    [...KEY_USAGES.wrap],
  );
}

/**
 * Import a raw 32-byte AES-KW key that may ONLY unwrap keys.
 *
 * - Usages: `["unwrapKey"]`. Extractable: `false`. Lifetime: per session.
 */
export function importKeyUnwrappingKey(raw: Uint8Array): Promise<CryptoKey> {
  assertAesKeyLength(raw);
  return crypto.subtle.importKey(
    "raw",
    copyBytes(raw),
    { name: "AES-KW" },
    false,
    [...KEY_USAGES.unwrap],
  );
}

/**
 * Import a raw HMAC-SHA-256 key that may ONLY sign.
 *
 * - Usages: `["sign"]`. Extractable: `false`. Lifetime: per session.
 */
export function importSigningKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    copyBytes(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [...KEY_USAGES.sign],
  );
}

/**
 * Import a raw HMAC-SHA-256 key that may ONLY verify.
 *
 * - Usages: `["verify"]`. Extractable: `false`. Lifetime: per session.
 */
export function importVerificationKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    copyBytes(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [...KEY_USAGES.verify],
  );
}
