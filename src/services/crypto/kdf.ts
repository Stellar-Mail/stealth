/**
 * HKDF-based domain-separated key derivation helpers (#1717).
 *
 * The crypto module previously generated a single AES key directly with no
 * shared KDF, which risks reusing one key across distinct purposes. This
 * module implements HKDF (RFC 5869) over HMAC-SHA-256 with explicit salt,
 * per-purpose fixed context labels, configurable output length, and a suite
 * binding, so body / attachment / commitment / wrapping subkeys are distinct
 * and deterministic for known-answer vectors.
 *
 * Self-contained (local KdfError) so the branch is independently mergeable.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class KdfError extends Error {
  readonly code = "crypto_algorithm_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "KdfError";
  }
}

/** Fixed, per-purpose context labels. Each purpose gets a unique constant. */
export const KEY_PURPOSES = {
  body: "stealth-envelope-body-v1",
  attachment: "stealth-envelope-attachment-v1",
  commitment: "stealth-envelope-commitment-v1",
  wrapping: "stealth-envelope-wrapping-v1",
} as const;

export type KeyPurpose = keyof typeof KEY_PURPOSES;

const SHA256_LENGTH = 32;

/** Copy into a fresh ArrayBuffer-backed view (satisfies the Web Crypto types). */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.length));
  out.set(u);
  return out;
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    buf(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, buf(data));
  return new Uint8Array(sig);
}

/**
 * HKDF-Extract (RFC 5869): derive a pseudo-random key from input key material
 * and a salt. A zero salt is used when none is provided (per RFC 5869 §2).
 */
export async function hkdfExtract(ikm: Uint8Array, salt?: Uint8Array): Promise<Uint8Array> {
  if (!ikm || ikm.length === 0) {
    throw new KdfError("HKDF input key material must be non-empty");
  }
  const usedSalt = salt && salt.length > 0 ? salt : new Uint8Array(SHA256_LENGTH);
  return hmacSha256(usedSalt, ikm);
}

/**
 * HKDF-Expand (RFC 5869): expand a pseudo-random key into `length` bytes using
 * a context label (info). Each distinct label yields distinct output.
 */
export async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!prk || prk.length === 0) {
    throw new KdfError("HKDF expand requires a non-empty pseudo-random key");
  }
  if (length <= 0) {
    throw new KdfError("HKDF output length must be positive");
  }
  const maxLength = SHA256_LENGTH * 255;
  if (length > maxLength) {
    throw new KdfError(`HKDF output length exceeds maximum ${maxLength} bytes`);
  }

  const blocks = Math.ceil(length / SHA256_LENGTH);
  const output = new Uint8Array(new ArrayBuffer(blocks * SHA256_LENGTH));
  let previous = buf(new Uint8Array(0));
  for (let i = 1; i <= blocks; i += 1) {
    const input = buf(new Uint8Array(previous.length + info.length + 1));
    input.set(previous, 0);
    input.set(info, previous.length);
    input[input.length - 1] = i;
    const block = await hmacSha256(prk, input);
    output.set(block, (i - 1) * SHA256_LENGTH);
    previous = buf(block);
  }
  return buf(output.slice(0, length));
}

/**
 * Derive a domain-separated subkey for a fixed purpose. Combines extract and
 * expand with the purpose's constant label as the info binding. Deterministic
 * for the same (ikm, salt, purpose, length) and distinct across purposes.
 */
export async function deriveKey(
  ikm: Uint8Array,
  purpose: KeyPurpose,
  length: number,
  salt?: Uint8Array,
): Promise<Uint8Array> {
  const prk = await hkdfExtract(ikm, salt);
  const info = new TextEncoder().encode(KEY_PURPOSES[purpose]);
  return hkdfExpand(prk, info, length);
}
