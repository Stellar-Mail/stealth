import { afterEach, describe, expect, it } from "vitest";

import {
  decodeNonce,
  encodeNonce,
  generateNonce,
  validateNonceLength,
  NONCE_LENGTHS,
} from "../../../src/services/crypto/nonce";
import { setCryptoTestVectors, resetCryptoTestVectors } from "../../../src/services/crypto/testing";

describe("secure nonce helpers (#1694)", () => {
  afterEach(() => {
    // Always restore production randomness.
    resetCryptoTestVectors();
  });

  it("derives nonce length from the algorithm suite", () => {
    for (const algorithm of Object.keys(NONCE_LENGTHS) as (keyof typeof NONCE_LENGTHS)[]) {
      expect(generateNonce(algorithm).length).toBe(NONCE_LENGTHS[algorithm]);
    }
  });

  it("uses crypto.getRandomValues in production and produces distinct values", () => {
    const a = generateNonce("AES-256-GCM");
    const b = generateNonce("AES-256-GCM");
    expect(a).not.toEqual(b);
  });

  it("accepts a deterministic injection for tests without weakening production", () => {
    let counter = 0;
    setCryptoTestVectors({
      getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i += 1) array[i] = (counter + i) & 0xff;
        counter += 1;
        return array;
      },
    });

    const nonce = generateNonce("AES-256-GCM");
    expect(nonce.length).toBe(12);
    expect([...nonce]).toEqual(Array.from({ length: 12 }, (_, i) => i & 0xff));
  });

  it("round-trips nonce encode/decode", () => {
    const nonce = generateNonce("AES-128-GCM");
    const encoded = encodeNonce(nonce);
    const decoded = decodeNonce(encoded, "AES-128-GCM");
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.value).toEqual(nonce);
  });

  it("rejects malformed hex (odd length)", () => {
    const result = decodeNonce("abc", "AES-256-GCM");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("crypto_validation_error");
  });

  it("rejects non-hex characters", () => {
    const result = decodeNonce("zzzzzzzzzzzz", "AES-256-GCM");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("crypto_validation_error");
  });

  it("rejects wrong-length nonces before any crypto call", () => {
    const tooShort = "0011";
    const result = decodeNonce(tooShort, "AES-256-GCM");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("crypto_validation_error");
  });

  it("rejects empty/non-string input", () => {
    expect(decodeNonce("", "AES-256-GCM").ok).toBe(false);
  });

  it("validateNonceLength fails on length mismatch", () => {
    const result = validateNonceLength(new Uint8Array(8), "AES-256-GCM");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("crypto_validation_error");
  });

  it("validateNonceLength passes on correct length", () => {
    const result = validateNonceLength(new Uint8Array(12), "AES-256-GCM");
    expect(result.ok).toBe(true);
  });
});
