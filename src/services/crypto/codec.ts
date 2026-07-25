/**
 * Strict hexadecimal and base64 codec helpers for cryptographic fields (#1695).
 *
 * The envelope module currently has ad hoc `toHex`/`toBase64` helpers but no
 * shared strict decoders or canonical encoding rules. Permissive decoding can
 * accept malformed ciphertext, tags, signatures, nonces, and keys.
 *
 * This module centralizes codecs that validate alphabet, padding, case policy,
 * byte length, and canonical round trips. It is intentionally self-contained
 * (its own minimal error type) so it is independently mergeable.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class CodecError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "CodecError";
  }
}

const HEX_LOWER = /^[0-9a-f]*$/;
const HEX_UPPER = /^[0-9A-F]*$/;
const BASE64_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

/** Canonical lowercase hex encoding. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Strict hex decoding.
 * - Rejects non-even length.
 * - Accepts either all-lowercase or all-uppercase (canonical output is lower),
 *   but rejects mixed case to avoid ambiguous encodings.
 * - Optionally enforces an expected byte length.
 */
export function fromHex(value: string, expectedLength?: number): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new CodecError("hex input must be a non-empty string");
  }
  if (value.length % 2 !== 0) {
    throw new CodecError("hex string must have an even number of characters");
  }
  const isLower = HEX_LOWER.test(value);
  const isUpper = HEX_UPPER.test(value);
  if (!isLower && !isUpper) {
    throw new CodecError("hex string must be uniformly lowercase or uppercase (no mixed case)");
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }

  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new CodecError(`hex decoded to ${bytes.length} bytes, expected ${expectedLength}`);
  }

  return bytes;
}

/** Canonical base64 encoding (RFC 4648, with padding). */
export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/**
 * Strict base64 decoding.
 * - Rejects characters outside the standard alphabet.
 * - Validates padding (length mod 4 == 0, at most two `=` at the end).
 * - Optionally enforces an expected byte length.
 */
export function fromBase64(value: string, expectedLength?: number): Uint8Array {
  if (typeof value !== "string" || value.length === 0) {
    throw new CodecError("base64 input must be a non-empty string");
  }
  if (value.length % 4 !== 0) {
    throw new CodecError("base64 string length must be a multiple of 4");
  }
  if (!BASE64_REGEX.test(value)) {
    throw new CodecError("base64 string contains invalid characters");
  }

  const padCount = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  if (padCount > 0) {
    const body = value.slice(0, value.length - padCount);
    if (!/^[A-Za-z0-9+/]*$/.test(body)) {
      throw new CodecError("base64 padding must only appear at the end");
    }
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch (err) {
    throw new CodecError("base64 decoding failed");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (expectedLength !== undefined && bytes.length !== expectedLength) {
    throw new CodecError(`base64 decoded to ${bytes.length} bytes, expected ${expectedLength}`);
  }

  return bytes;
}
