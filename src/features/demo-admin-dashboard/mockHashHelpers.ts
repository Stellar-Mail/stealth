/**
 * Mock hash helpers for generating deterministic fake proof hashes.
 *
 * All output is fake demo data — no real cryptographic operations are performed.
 * Values are deterministic given the same seed so fixtures stay stable.
 */

/** Number of hex chars in a 32-byte hash (64 hex digits). */
const HASH_HEX_LENGTH = 64;

/** Characters used when building deterministic hex strings. */
const HEX_CHARS = "0123456789abcdef";

/**
 * Derive a deterministic numeric seed from a string.
 * Uses a simple djb2-style hash so the output is pure, predictable TS.
 */
function seedFrom(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Build a `HASH_HEX_LENGTH`-character lowercase hex string from a seed.
 * The progression uses a linear-congruential step so consecutive digits differ.
 */
function hexFromSeed(seed: number): string {
  let state = seed;
  let result = "";
  for (let i = 0; i < HASH_HEX_LENGTH; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    result += HEX_CHARS[state & 0xf];
  }
  return result;
}

/**
 * Generate a deterministic fake 32-byte message hash for `messageId`.
 *
 * @example
 * mockMessageHash("msg-001") // "0x4a3f..."
 */
export function mockMessageHash(messageId: string): string {
  return `0x${hexFromSeed(seedFrom(`msg:${messageId}`))}`;
}

/**
 * Generate a deterministic fake 32-byte payment hash for `paymentRef`.
 *
 * @example
 * mockPaymentHash("pay-001") // "0xe9b2..."
 */
export function mockPaymentHash(paymentRef: string): string {
  return `0x${hexFromSeed(seedFrom(`pay:${paymentRef}`))}`;
}

/**
 * Generate a deterministic fake UUID-shaped diagnostic ID for `traceKey`.
 *
 * @example
 * mockDiagnosticId("trace-001") // "d1f038c7-..."
 */
export function mockDiagnosticId(traceKey: string): string {
  const s = seedFrom(`diag:${traceKey}`);
  const h = hexFromSeed(s);
  // Format as xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join(
    "-",
  );
}

/**
 * Generate a deterministic fake Ed25519 signature string for `signKey`.
 *
 * @example
 * mockSignature("msg-001") // "Ed25519 [0xabc...]"
 */
export function mockSignature(signKey: string): string {
  const hex = hexFromSeed(seedFrom(`sig:${signKey}`));
  return `Ed25519 [0x${hex.slice(0, 16)}]`;
}
