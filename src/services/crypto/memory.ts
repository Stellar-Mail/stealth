/**
 * Memory-optimized crypto buffer utilities.
 *
 * Provides:
 * - Lookup-table hex encoding (O(n), no intermediate string concatenation)
 * - Direct base64 encoding (no intermediate binary string)
 * - SHA-256 digest-to-hex with no redundant Uint8Array wrapping
 * - Size-bucketed ArrayBuffer pool for reuse of transient allocations
 *
 * All helpers are self-contained and intentionally decoupled from sibling
 * crypto modules so they can be imported without circular dependencies.
 */

const HEX_CHARS = "0123456789abcdef";
const HEX_TABLE: string[] = Array.from(
  { length: 256 },
  (_, i) => HEX_CHARS[i >> 4] + HEX_CHARS[i & 0xf],
);

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// ---------------------------------------------------------------------------
// Hex codec
// ---------------------------------------------------------------------------

/** O(n) hex encoding via pre-computed 256-entry lookup table. */
export function toHex(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return "";
  const out = new Array<string>(len);
  for (let i = 0; i < len; i += 1) {
    out[i] = HEX_TABLE[bytes[i]];
  }
  return out.join("");
}

/** Decode a lowercase hex string to Uint8Array. Throws on invalid input. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length === 0 || hex.length % 2 !== 0) {
    throw new Error("hex string must be non-empty with even length");
  }
  if (/[^0-9a-fA-F]/.test(hex)) {
    throw new Error("hex string contains non-hex characters");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base64 codec
// ---------------------------------------------------------------------------

/**
 * Direct base64 encoding without an intermediate binary string.
 *
 * The naive `btoa(String.fromCharCode(...bytes))` approach creates a
 * transient JS "rope" string ~1 byte per input byte, doubling peak string
 * memory for large payloads. This implementation encodes 3 bytes → 4 chars
 * at a time using a pre-computed alphabet, appending to an array that is
 * joined once at the end.
 */
export function toBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return "";

  const charCount = ((len + 2) / 3) | 0;
  const parts = new Array<string>(charCount);
  let idx = 0;

  for (let i = 0; i + 2 < len; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    parts[idx++] =
      B64_ALPHABET[(a >> 2) & 0x3f] +
      B64_ALPHABET[((a << 4) | (b >> 4)) & 0x3f] +
      B64_ALPHABET[((b << 2) | (c >> 6)) & 0x3f] +
      B64_ALPHABET[c & 0x3f];
  }

  const rem = len % 3;
  if (rem === 1) {
    const a = bytes[len - 1];
    parts[idx++] = B64_ALPHABET[(a >> 2) & 0x3f] + B64_ALPHABET[(a << 4) & 0x3f] + "==";
  } else if (rem === 2) {
    const a = bytes[len - 2];
    const b = bytes[len - 1];
    parts[idx++] =
      B64_ALPHABET[(a >> 2) & 0x3f] +
      B64_ALPHABET[((a << 4) | (b >> 4)) & 0x3f] +
      B64_ALPHABET[(b << 2) & 0x3f] +
      "=";
  }

  return parts.join("");
}

/** Decode a base64 string to Uint8Array. */
export function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// SHA-256 digest
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash of raw bytes, returned as a lowercase hex string.
 *
 * Avoids redundant wrapping when the input is already an ArrayBuffer-backed
 * Uint8Array. A copy is made only when the backing buffer is not an
 * ArrayBuffer (e.g. SharedArrayBuffer) to satisfy the Web Crypto type.
 */
export async function digestHex(data: Uint8Array): Promise<string> {
  const source: Uint8Array<ArrayBuffer> =
    data.buffer instanceof ArrayBuffer ? (data as Uint8Array<ArrayBuffer>) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", source);
  return toHex(new Uint8Array(digest));
}

// ---------------------------------------------------------------------------
// Secret erasure
// ---------------------------------------------------------------------------

/**
 * Best-effort zeroing of a mutable Uint8Array. JavaScript cannot guarantee
 * memory erasure (the runtime may have copied the underlying memory), but
 * zeroing avoids leaving plaintext in recoverable heap buffers.
 */
export function clearSecret(buffer: Uint8Array): void {
  if (buffer.length > 0) {
    buffer.fill(0);
  }
}

// ---------------------------------------------------------------------------
// ArrayBuffer pool
// ---------------------------------------------------------------------------

/**
 * Size-bucketed ArrayBuffer pool.
 *
 * Reuses ArrayBuffers across sequential crypto operations so that large
 * transient allocations (plaintext encoding, ciphertext, IV copies) are
 * recycled rather than freshly GC'd each time.
 *
 * Bucket strategy: powers-of-two starting at 256 bytes, plus one "large"
 * bucket for anything above 64 KiB. The pool caps each bucket at 8 entries
 * to bound total pooled memory.
 *
 * Usage:
 *   const buf = pool.acquire(size);
 *   try { /* use buf *\/ } finally { pool.release(buf); }
 *
 * This is a best-effort optimization: the pool does not guarantee reuse
 * (e.g. if the released buffer is the wrong size) and never prevents GC.
 */
export class BufferPool {
  private readonly buckets: Map<number, ArrayBuffer[]> = new Map();
  private readonly maxPerBucket: number;

  /**
   * @param maxPerBucket  Maximum retained buffers per size bucket (default 8).
   */
  constructor(maxPerBucket = 8) {
    this.maxPerBucket = maxPerBucket;
  }

  /**
   * Acquire an ArrayBuffer of at least `minByteLength` bytes.
   *
   * If a pooled buffer of the matching bucket size is available, it is
   * returned (cleared to zero). Otherwise a fresh ArrayBuffer is allocated.
   * The returned buffer may be larger than requested (up to the next bucket).
   */
  acquire(minByteLength: number): ArrayBuffer {
    const bucket = this.bucketFor(minByteLength);
    const pool = this.buckets.get(bucket);
    if (pool && pool.length > 0) {
      const buf = pool.pop()!;
      new Uint8Array(buf).fill(0);
      return buf;
    }
    return new ArrayBuffer(bucket);
  }

  /**
   * Release a buffer back to the pool for future reuse.
   *
   * The buffer is zeroed before return (best-effort secret erasure). If the
   * pool for this bucket is full the buffer is simply dropped for GC.
   */
  release(buffer: ArrayBuffer): void {
    const bucket = this.bucketFor(buffer.byteLength);
    new Uint8Array(buffer).fill(0);
    let pool = this.buckets.get(bucket);
    if (!pool) {
      pool = [];
      this.buckets.set(bucket, pool);
    }
    if (pool.length < this.maxPerBucket) {
      pool.push(buffer);
    }
  }

  /** Number of currently pooled buffers (across all buckets). */
  get pooledCount(): number {
    let n = 0;
    for (const pool of this.buckets.values()) n += pool.length;
    return n;
  }

  /** Drop all pooled buffers. */
  clear(): void {
    for (const pool of this.buckets.values()) pool.length = 0;
    this.buckets.clear();
  }

  private bucketFor(size: number): number {
    if (size <= 256) return 256;
    if (size <= 512) return 512;
    if (size <= 1024) return 1024;
    if (size <= 2048) return 2048;
    if (size <= 4096) return 4096;
    if (size <= 8192) return 8192;
    if (size <= 16384) return 16384;
    if (size <= 32768) return 32768;
    if (size <= 65536) return 65536;
    return Math.ceil(size / 65536) * 65536;
  }
}

/** Module-level shared pool instance. */
export const sharedPool = new BufferPool();
