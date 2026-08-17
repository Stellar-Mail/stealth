/**
 * Constant-time password hashing and verification using Web Crypto API PBKDF2-SHA256.
 *
 * Implements constant-time string comparison and dummy hash calculation to ensure
 * login execution time does not reveal whether a user account or credential exists.
 */

const PBKDF2_ITERATIONS = 100_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const DUMMY_SALT_HEX = "00112233445566778899aabbccddeeff";
const DUMMY_HASH_HEX = "a".repeat(64);

/**
 * Compares two strings in constant time.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    const codeA = i < a.length ? a.charCodeAt(i) : 0;
    const codeB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= codeA ^ codeB;
  }
  return mismatch === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(u.length));
  out.set(u);
  return out;
}

/**
 * Hash a password using PBKDF2 with SHA-256.
 */
export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const saltBytes = saltHex
    ? hexToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    buf(passwordBytes),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: buf(saltBytes),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BYTES * 8,
  );

  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  const finalSaltHex = saltHex ?? bytesToHex(saltBytes);

  return { hash: hashHex, salt: finalSaltHex };
}

/**
 * Verify a password against a stored hash and salt.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  saltHex: string,
): Promise<boolean> {
  const { hash: computedHash } = await hashPassword(password, saltHex);
  return constantTimeCompare(computedHash, storedHash);
}

/**
 * Performs a dummy password hash calculation to match the latency of a real verification,
 * preventing email/username enumeration via timing side-channels. Always returns false.
 */
export async function dummyVerifyPassword(password: string): Promise<boolean> {
  await verifyPassword(password, DUMMY_HASH_HEX, DUMMY_SALT_HEX);
  return false;
}
