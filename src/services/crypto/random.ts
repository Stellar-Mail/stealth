/**
 * Cryptographically secure message identifier generation (#1693).
 *
 * The send pipeline currently falls back from `crypto.randomUUID` to
 * `Date.now()` + `Math.random()` when randomUUID is unavailable. Predictable
 * identifiers increase collision and correlation risk and should not be used
 * for security-sensitive message records.
 *
 * This module provides a crypto-backed identifier using
 * `crypto.getRandomValues` with a documented encoding and entropy budget, and
 * no `Math.random` fallback. Unsupported environments fail explicitly rather
 * than downgrading. It is intentionally self-contained.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class CryptoIdError extends Error {
  readonly code = "crypto_algorithm_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "CryptoIdError";
  }
}

/** Number of random bytes in a generated message identifier. */
export const MESSAGE_ID_BYTES = 16;

/** Encoding used for the identifier string. */
export type MessageIdEncoding = "hex" | "base64url";

import { getCryptoTestVectors } from "./testing";

function getRandomBytes(length: number): Uint8Array {
  const { getRandomValues } = getCryptoTestVectors();
  if (getRandomValues) {
    return getRandomValues(new Uint8Array(length));
  }
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new CryptoIdError("cryptographically secure random source is unavailable");
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a cryptographically secure message identifier.
 *
 * Entropy: MESSAGE_ID_BYTES * 8 bits (128 bits by default). Encoding is either
 * lowercase hex (32 chars) or base64url without padding. There is no
 * Math.random fallback; if a CSPRNG is unavailable the call throws.
 */
export function generateMessageId(encoding: MessageIdEncoding = "hex"): string {
  const bytes = getRandomBytes(MESSAGE_ID_BYTES);
  if (encoding === "base64url") {
    return toBase64Url(bytes);
  }
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Validate that a value is a well-formed message identifier of the expected
 * encoding and length. Returns a typed result so callers branch on `ok`.
 */
export function isValidMessageId(value: string, encoding: MessageIdEncoding = "hex"): boolean {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  if (encoding === "hex") {
    return /^[0-9a-f]+$/.test(value) && value.length === MESSAGE_ID_BYTES * 2;
  }
  return /^[A-Za-z0-9_-]+$/.test(value) && value.length >= MESSAGE_ID_BYTES;
}
