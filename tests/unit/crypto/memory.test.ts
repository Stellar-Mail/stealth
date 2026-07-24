import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  toHex,
  fromHex,
  toBase64,
  fromBase64,
  digestHex,
  BufferPool,
  sharedPool,
} from "../../../src/services/crypto/memory";

// ---------------------------------------------------------------------------
// toHex
// ---------------------------------------------------------------------------

describe("memory/toHex", () => {
  it("returns empty string for empty input", () => {
    expect(toHex(new Uint8Array(0))).toBe("");
  });

  it("encodes single byte 0x00", () => {
    expect(toHex(new Uint8Array([0x00]))).toBe("00");
  });

  it("encodes single byte 0xff", () => {
    expect(toHex(new Uint8Array([0xff]))).toBe("ff");
  });

  it("encodes multi-byte sequence correctly", () => {
    const input = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    expect(toHex(input)).toBe("deadbeef");
  });

  it("pads single-digit hex values with leading zero", () => {
    const input = new Uint8Array([0x01, 0x0a, 0x0f]);
    expect(toHex(input)).toBe("010a0f");
  });

  it("matches known SHA-256 hex length (64 chars for 32 bytes)", () => {
    const hash = new Uint8Array(32).fill(0xab);
    expect(toHex(hash)).toHaveLength(64);
    expect(toHex(hash)).toBe("ab".repeat(32));
  });
});

// ---------------------------------------------------------------------------
// fromHex
// ---------------------------------------------------------------------------

describe("memory/fromHex", () => {
  it("throws on empty string", () => {
    expect(() => fromHex("")).toThrow();
  });

  it("round-trips with toHex", () => {
    const original = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hex = toHex(original);
    const decoded = fromHex(hex);
    expect(decoded).toEqual(original);
  });

  it("throws on odd-length hex string", () => {
    expect(() => fromHex("abc")).toThrow();
  });

  it("throws on non-hex characters", () => {
    expect(() => fromHex("xyz0")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// toBase64 / fromBase64
// ---------------------------------------------------------------------------

describe("memory/toBase64", () => {
  it("returns empty string for empty input", () => {
    expect(toBase64(new Uint8Array(0))).toBe("");
  });

  it("encodes known RFC 4648 test vectors", () => {
    // RFC 4648 §10 test vectors
    expect(toBase64(new Uint8Array([]))).toBe("");
    expect(toBase64(new Uint8Array([0x66]))).toBe("Zg==");
    expect(toBase64(new Uint8Array([0x66, 0x6f]))).toBe("Zm8=");
    expect(toBase64(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe("Zm9v");
  });

  it("encodes all-zero bytes", () => {
    const input = new Uint8Array([0x00, 0x00, 0x00]);
    expect(toBase64(input)).toBe("AAAA");
  });

  it("encodes max byte value", () => {
    const input = new Uint8Array([0xff]);
    expect(toBase64(input)).toBe("/w==");
  });
});

describe("memory/fromBase64", () => {
  it("round-trips with toBase64", () => {
    const original = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    const b64 = toBase64(original);
    const decoded = fromBase64(b64);
    expect(decoded).toEqual(original);
  });

  it("decodes known vectors", () => {
    expect(fromBase64("Zm9v")).toEqual(new Uint8Array([0x66, 0x6f, 0x6f]));
    expect(fromBase64("Zg==")).toEqual(new Uint8Array([0x66]));
  });
});

describe("memory/toBase64 ↔ fromBase64 round-trip", () => {
  it("round-trips random byte sequences of various lengths", () => {
    for (const len of [1, 2, 3, 4, 7, 16, 63, 64, 65, 128, 255, 256, 1000]) {
      const input = new Uint8Array(len);
      crypto.getRandomValues(input);
      const encoded = toBase64(input);
      const decoded = fromBase64(encoded);
      expect(decoded).toEqual(input);
    }
  });
});

// ---------------------------------------------------------------------------
// digestHex
// ---------------------------------------------------------------------------

describe("memory/digestHex", () => {
  it("SHA-256 of empty string matches known hash", async () => {
    const result = await digestHex(new Uint8Array(0));
    expect(result).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("SHA-256 of 'hello' matches known hash", async () => {
    const data = new TextEncoder().encode("hello");
    const result = await digestHex(data);
    expect(result).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("returns 64-char lowercase hex string", async () => {
    const data = new Uint8Array([1, 2, 3]);
    const result = await digestHex(data);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not re-wrap Uint8Array input (no redundant copy)", async () => {
    // This is a behavioral assertion: digestHex accepts Uint8Array directly
    // and passes it to crypto.subtle.digest without wrapping in new Uint8Array(data).
    // The test verifies the function works with Uint8Array views over ArrayBuffers.
    const buf = new ArrayBuffer(5);
    const view = new Uint8Array(buf);
    view.set([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
    const result = await digestHex(view);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------------------------------------------------------------------------
// BufferPool
// ---------------------------------------------------------------------------

describe("memory/BufferPool", () => {
  let pool: BufferPool;

  beforeEach(() => {
    pool = new BufferPool(4);
  });

  afterEach(() => {
    pool.clear();
  });

  it("acquire returns ArrayBuffer of at least the requested size", () => {
    const buf = pool.acquire(100);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThanOrEqual(100);
  });

  it("acquire returns bucket-aligned size (power of two)", () => {
    const buf = pool.acquire(100);
    // Bucket for 100 is 256
    expect(buf.byteLength).toBe(256);
  });

  it("released buffer is returned to pool and reused", () => {
    const buf = pool.acquire(256);
    pool.release(buf);
    expect(pool.pooledCount).toBe(1);

    const reused = pool.acquire(256);
    expect(reused).toBe(buf); // same ArrayBuffer reference
    expect(pool.pooledCount).toBe(0);
  });

  it("acquired buffer is zeroed", () => {
    const buf = pool.acquire(256);
    new Uint8Array(buf).fill(0x42);
    pool.release(buf);

    const reused = pool.acquire(256);
    const bytes = new Uint8Array(reused);
    for (let i = 0; i < bytes.length; i++) {
      expect(bytes[i]).toBe(0);
    }
  });

  it("released buffer is zeroed before pool return", () => {
    const buf = pool.acquire(256);
    new Uint8Array(buf).fill(0xff);
    pool.release(buf);

    // The buffer in the pool should be zeroed
    const raw = new Uint8Array(buf);
    for (let i = 0; i < raw.length; i++) {
      expect(raw[i]).toBe(0);
    }
  });

  it("respects maxPerBucket limit", () => {
    const bufs = Array.from({ length: 6 }, () => pool.acquire(256));
    for (const b of bufs) pool.release(b);
    // Pool maxPerBucket is 4, so only 4 are kept
    expect(pool.pooledCount).toBe(4);
  });

  it("clear empties all buckets", () => {
    const buf = pool.acquire(256);
    pool.release(buf);
    expect(pool.pooledCount).toBe(1);
    pool.clear();
    expect(pool.pooledCount).toBe(0);
  });

  it("different sizes go into different buckets", () => {
    const small = pool.acquire(100);
    const large = pool.acquire(1024);
    pool.release(small);
    pool.release(large);
    expect(pool.pooledCount).toBe(2);
  });

  it("large allocation (>64 KiB) uses next multiple of 64 KiB", () => {
    const buf = pool.acquire(100_000);
    expect(buf.byteLength).toBe(131072); // 2 × 65536
  });
});

// ---------------------------------------------------------------------------
// sharedPool singleton
// ---------------------------------------------------------------------------

describe("memory/sharedPool", () => {
  it("is a BufferPool instance", () => {
    expect(sharedPool).toBeInstanceOf(BufferPool);
  });

  it("can acquire and release without error", () => {
    const buf = sharedPool.acquire(64);
    expect(buf.byteLength).toBeGreaterThanOrEqual(64);
    sharedPool.release(buf);
  });
});
