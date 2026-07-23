import { describe, expect, it } from "vitest";
import { fromHex, toHex, fromBase64, toBase64, CodecError } from "../../../src/services/crypto/codec";
import { sealEnvelope } from "../../../src/services/crypto/envelope";
import { openEnvelope, OpenEnvelopeError, type KeyProvider } from "../../../src/services/crypto/open-envelope";
import { CryptoError } from "../../../src/services/crypto/errors";

/** Seedable PRNG (Mulberry32) for reproducible property tests. */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function nextFloat(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function genBytes(rand: () => number, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(rand() * 256);
  }
  return bytes;
}

function genPrintableString(rand: () => number, length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/ ";
  let res = "";
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(rand() * chars.length)];
  }
  return res;
}

function keyProviderFor(key: CryptoKey, recipient = "GABC"): KeyProvider {
  return {
    resolveKey: async (r) => {
      if (r !== recipient) throw new Error("Key unavailable for recipient");
      return key;
    },
  };
}

describe("Property-Based Crypto Tests - Codecs & Invariants (#1723)", () => {
  const INITIAL_SEED = 172399;

  describe("Property 1: Codec Encode-Decode Round Trip for Arbitrary Bytes", () => {
    it("preserves exact byte arrays across toHex/fromHex and toBase64/fromBase64", () => {
      const rand = createPrng(INITIAL_SEED);
      const testRuns = 100;

      for (let run = 0; run < testRuns; run++) {
        const seed = INITIAL_SEED + run;
        const length = randInt(rand, 0, 512);
        const originalBytes = genBytes(rand, length);

        try {
          // Hex round-trip
          const hex = toHex(originalBytes);
          expect(hex).toMatch(/^[0-9a-f]*$/);
          expect(hex.length).toBe(length * 2);

          const decodedHexBytes = fromHex(hex);
          expect(decodedHexBytes).toEqual(originalBytes);

          // Base64 round-trip
          const b64 = toBase64(originalBytes);
          expect(b64.length % 4).toBe(0);

          const decodedB64Bytes = fromBase64(b64);
          expect(decodedB64Bytes).toEqual(originalBytes);

          // Expected length checks
          const decodedHexWithLength = fromHex(hex, length);
          expect(decodedHexWithLength.length).toBe(length);

          const decodedB64WithLength = fromBase64(b64, length);
          expect(decodedB64WithLength.length).toBe(length);
        } catch (err) {
          throw new Error(`Property 1 failed at seed ${seed}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });

  describe("Property 2: Invalid Lengths and Alphabets are Strictly Rejected", () => {
    it("rejects invalid hex encodings (odd length, mixed case, non-hex, length mismatch)", () => {
      const rand = createPrng(INITIAL_SEED + 1000);

      for (let run = 0; run < 50; run++) {
        const seed = INITIAL_SEED + 1000 + run;
        try {
          // Odd length hex
          const oddHex = "a".repeat(randInt(rand, 1, 25) * 2 + 1);
          expect(() => fromHex(oddHex)).toThrow(CodecError);

          // Mixed-case hex
          const mixedHex = "aB12cdEF34gh".replace("gh", "56");
          expect(() => fromHex(mixedHex)).toThrow(CodecError);

          // Non-hex character
          const invalidCharHex = "1234567890xy";
          expect(() => fromHex(invalidCharHex)).toThrow(CodecError);

          // Length mismatch
          const validHex = "deadbeef";
          expect(() => fromHex(validHex, 10)).toThrow(CodecError);
        } catch (err) {
          throw new Error(`Property 2 (Hex) failed at seed ${seed}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

    it("rejects invalid base64 encodings (non-mod-4 length, bad chars, bad padding)", () => {
      const rand = createPrng(INITIAL_SEED + 2000);

      for (let run = 0; run < 50; run++) {
        const seed = INITIAL_SEED + 2000 + run;
        try {
          // Non-multiple of 4 length
          const badLenB64 = "AAAAA";
          expect(() => fromBase64(badLenB64)).toThrow(CodecError);

          // Invalid base64 URL-safe or special characters
          const invalidCharB64 = "AAA-";
          expect(() => fromBase64(invalidCharB64)).toThrow(CodecError);

          // Misplaced padding
          const misplacedPadB64 = "=AAA";
          expect(() => fromBase64(misplacedPadB64)).toThrow(CodecError);

          // Length mismatch
          const validB64 = toBase64(new Uint8Array([1, 2, 3, 4]));
          expect(() => fromBase64(validB64, 100)).toThrow(CodecError);
        } catch (err) {
          throw new Error(`Property 2 (Base64) failed at seed ${seed}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });

  describe("Property 3: Seal-Open Invariants for Generated Valid Envelopes", () => {
    it("holds seal-open invariants across 20 generated valid envelopes", async () => {
      const rand = createPrng(INITIAL_SEED + 3000);

      for (let run = 0; run < 20; run++) {
        const seed = INITIAL_SEED + 3000 + run;
        const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
          "encrypt",
          "decrypt",
        ]);

        const sender = `SENDER_${genPrintableString(rand, 8)}`;
        const recipient = `RECIPIENT_${genPrintableString(rand, 8)}`;
        const body = `Body text run ${run}: ${genPrintableString(rand, randInt(rand, 10, 200))}`;

        try {
          const sealed = await sealEnvelope({ sender, recipient, body });

          expect(sealed.payload.version).toBe("v1");
          expect(sealed.payload.sender).toBe(sender);
          expect(sealed.payload.recipient).toBe(recipient);
          expect(sealed.payload.encryption_metadata.algorithm).toBe("AES-256-GCM");
          expect(sealed.payload.content_commitment).toMatch(/^v1:sha256:hex:[0-9a-f]{64}$/);

          const opened = await openEnvelope(sealed, keyProviderFor(key, recipient));
          expect(opened.sender).toBe(sender);
          expect(opened.recipient).toBe(recipient);
          expect(opened.body).toBe(body);
        } catch (err) {
          throw new Error(`Property 3 failed at seed ${seed}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });

  describe("Property 4: Tamper Fail-Closed Invariants for Generated Inputs", () => {
    it("strictly fails closed on mutated ciphertext, nonce, MAC, or key for 20 generated inputs", async () => {
      const rand = createPrng(INITIAL_SEED + 4000);

      for (let run = 0; run < 20; run++) {
        const seed = INITIAL_SEED + 4000 + run;
        const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
          "encrypt",
          "decrypt",
        ]);
        const otherKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
          "encrypt",
          "decrypt",
        ]);

        const recipient = `REC_${run}`;
        const body = `Tamper test body ${run} - ${genPrintableString(rand, 50)}`;

        try {
          const sealed = await sealEnvelope({ sender: "SENDER", recipient, body });

          // 1. Wrong key must fail closed
          await expect(openEnvelope(sealed, keyProviderFor(otherKey, recipient))).rejects.toSatisfy((e) => {
            return e instanceof OpenEnvelopeError || e instanceof CryptoError;
          });

          // 2. Mutated MAC must fail closed
          const badMacSealed = {
            ...sealed,
            payload: {
              ...sealed.payload,
              encryption_metadata: {
                ...sealed.payload.encryption_metadata,
                mac: "00".repeat(16),
              },
            },
          };
          await expect(openEnvelope(badMacSealed, keyProviderFor(key, recipient))).rejects.toSatisfy((e) => {
            return e instanceof OpenEnvelopeError || e instanceof CryptoError;
          });

          // 3. Mutated Commitment must fail closed
          const badCommitmentSealed = {
            ...sealed,
            payload: {
              ...sealed.payload,
              content_commitment: "v1:sha256:hex:" + "00".repeat(32),
            },
          };
          await expect(openEnvelope(badCommitmentSealed, keyProviderFor(key, recipient))).rejects.toSatisfy((e) => {
            return e instanceof OpenEnvelopeError || e instanceof CryptoError;
          });
        } catch (err) {
          throw new Error(`Property 4 failed at seed ${seed}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });
  });
});
