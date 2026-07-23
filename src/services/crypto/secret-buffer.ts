/**
 * Best-effort secret buffer disposal utilities (#1719).
 *
 * Plaintext `Uint8Array` values and temporary key-export buffers are created
 * without a shared cleanup strategy. JavaScript cannot guarantee memory
 * erasure, but avoidable copies and long-lived buffers should still be
 * minimized and cleared where practical.
 *
 * This module centralizes scoped zeroing utilities. It does NOT claim
 * guaranteed erasure. Public APIs return immutable/isolated views where
 * possible and minimize copies of secret material. It is self-contained.
 */

/** A buffer whose bytes can be cleared (e.g. Uint8Array over a mutable ArrayBuffer). */
export type SecretBuffer = Uint8Array;

/**
 * Zero a mutable buffer in place. Best-effort only: the runtime may have copied
 * the underlying memory, so this cannot guarantee the secret is gone from all
 * locations. Returns the same buffer for chaining.
 */
export function clearSecret(buffer: SecretBuffer): SecretBuffer {
  if (buffer && buffer.length > 0) {
    buffer.fill(0);
  }
  return buffer;
}

/**
 * Run `action` with a freshly allocated secret buffer, guaranteeing (where
 * possible) that the buffer is zeroed afterwards via a `finally` block. The
 * action receives the buffer; its return value is passed through.
 *
 * NOTE: erasure is best-effort. If `action` copies the bytes elsewhere, those
 * copies are outside this helper's control.
 */
export function withSecretBuffer<T>(length: number, action: (buffer: SecretBuffer) => T): T {
  const buffer = new Uint8Array(length);
  try {
    return action(buffer);
  } finally {
    buffer.fill(0);
  }
}

/**
 * Best-effort zeroing of a temporary raw-key export. Accepts any ArrayBuffer or
 * typed array view. Returns void; purely a cleanup aid.
 */
export function disposeRawKey(key: ArrayBuffer | SecretBuffer): void {
  if (key instanceof ArrayBuffer) {
    new Uint8Array(key).fill(0);
    return;
  }
  if (key && typeof (key as SecretBuffer).fill === "function") {
    (key as SecretBuffer).fill(0);
  }
}

/** Returns true if the buffer is entirely zero (used by tests to confirm clearing). */
export function isZeroed(buffer: SecretBuffer): boolean {
  if (!buffer || buffer.length === 0) return true;
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] !== 0) return false;
  }
  return true;
}
