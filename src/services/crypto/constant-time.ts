/**
 * Constant-time byte comparison (#1718).
 *
 * Comparing secret-derived values (commitments, auth tags, key identifiers,
 * signatures) with ordinary `===` can leak timing differences that disclose
 * where two byte sequences first diverge. This helper compares equal-length
 * byte arrays without early-exit, and follows a documented safe path for
 * length mismatches.
 *
 * This module is intentionally self-contained: it defines its own minimal,
 * non-secret error type so it does not depend on sibling crypto modules that
 * may land in separate PRs.
 */

/** Minimal non-secret error carrying a stable code (no key/plaintext leakage). */
export class ConstantTimeError extends Error {
  readonly code = "crypto_validation_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConstantTimeError";
  }
}

/**
 * Compare two equal-length byte arrays in constant time.
 *
 * - Runs without early exit: every position is always visited, so the elapsed
 *   time does not depend on the location of the first differing byte.
 * - If the lengths differ, the function returns `false` via a path that still
 *   performs a full comparison of the overlapping prefix. This avoids a cheap
 *   length-only shortcut that could be used as a timing oracle to learn the
 *   expected length of a secret.
 *
 * Callers should compare decoded bytes (not encoded hex/base64 strings).
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const length = Math.min(a.length, b.length);
  let mismatch = 0;

  // Always iterate the full length of the longer input so timing does not
  // reveal which value is longer.
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i += 1) {
    const x = i < a.length ? a[i] : 0;
    const y = i < b.length ? b[i] : 0;
    mismatch |= x ^ y;
  }

  // A length difference must not be distinguishable by an early return, so we
  // fold the length check into the same accumulated mismatch value.
  mismatch |= a.length ^ b.length;
  return mismatch === 0;
}

/**
 * Compare two byte arrays, throwing a non-secret {@link CryptoError} when the
 * length is wrong rather than returning `false`. Use this when the caller
 * expects well-formed inputs and a length mismatch is itself a validation
 * failure.
 */
export function constantTimeEqualOrThrow(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    throw new ConstantTimeError("compared byte arrays differ in length");
  }
  return constantTimeEqual(a, b);
}
