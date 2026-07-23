import { describe, expect, it } from "vitest";

import {
  CRYPTO_ERROR_REGISTRY,
  CryptoError,
  cryptoFail,
  cryptoOk,
  redact,
  toCryptoError,
  type CryptoErrorCode,
} from "../../../src/services/crypto/errors";

const ALL_CODES = Object.keys(CRYPTO_ERROR_REGISTRY) as CryptoErrorCode[];

describe("crypto error taxonomy (#1690)", () => {
  it("defines a stable code per required failure category", () => {
    for (const code of [
      "crypto_parse_error",
      "crypto_validation_error",
      "crypto_algorithm_error",
      "crypto_key_error",
      "crypto_signature_error",
      "crypto_commitment_error",
      "crypto_decrypt_error",
    ] as CryptoErrorCode[]) {
      expect(ALL_CODES).toContain(code);
      expect(CRYPTO_ERROR_REGISTRY[code].safe).toBe(true);
    }
  });

  it("every public message is safe (non-empty, no secret-looking content)", () => {
    for (const code of ALL_CODES) {
      const message = CRYPTO_ERROR_REGISTRY[code].publicMessage;
      expect(message.length).toBeGreaterThan(0);
      // The public message must not itself contain high-entropy blobs.
      expect(redact(message)).toBe(message);
    }
  });

  it("CryptoError exposes the code and a fixed non-secret message", () => {
    const error = new CryptoError("crypto_signature_error");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("crypto_signature_error");
    expect(error.safe).toBe(true);
    expect(error.message).toBe(CRYPTO_ERROR_REGISTRY.crypto_signature_error.publicMessage);
    expect(error.message).not.toMatch(/[0-9a-fA-F]{16,}/);
  });

  it("redacts high-entropy hex and base64 from details", () => {
    const details = redact(
      "key=deadbeefdeadbeefdeadbeefdeadbeef and b64=QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIz",
    );
    expect(details).not.toContain("deadbeef");
    expect(details).toContain("[redacted-hex]");
    expect(details).toContain("[redacted-b64]");
  });

  it("attaches redacted details without leaking into the message", () => {
    const error = new CryptoError("crypto_key_error", "secret=00112233445566778899aabbccddeeff");
    expect(error.details).toContain("[redacted-hex]");
    expect(error.message).toBe(CRYPTO_ERROR_REGISTRY.crypto_key_error.publicMessage);
    expect(error.message).not.toContain("00112233");
  });

  it("callers can branch on the code without parsing message text", () => {
    const error = new CryptoError("crypto_commitment_error");
    switch (error.code) {
      case "crypto_commitment_error":
        expect(true).toBe(true);
        break;
      default:
        throw new Error("should not reach default");
    }
  });

  it("toCryptoError passes through an existing CryptoError", () => {
    const original = new CryptoError("crypto_algorithm_error");
    const mapped = toCryptoError(original, "crypto_decrypt_error");
    expect(mapped).toBe(original);
    expect(mapped.code).toBe("crypto_algorithm_error");
  });

  it("toCryptoError discards raw messages and uses the safe fallback", () => {
    const generic = new Error("AES key 0011223344556677 failed to unwrap plaintext 'hello'");
    const mapped = toCryptoError(generic, "crypto_decrypt_error");
    expect(mapped).toBeInstanceOf(CryptoError);
    expect(mapped.code).toBe("crypto_decrypt_error");
    expect(mapped.message).toBe(CRYPTO_ERROR_REGISTRY.crypto_decrypt_error.publicMessage);
    expect(mapped.message).not.toContain("hello");
    expect(mapped.message).not.toContain("00112233");
  });

  it("toCryptoError coerces a known code marker", () => {
    const mapped = toCryptoError(new Error("crypto_signature_error"), "crypto_decrypt_error");
    expect(mapped.code).toBe("crypto_signature_error");
  });

  it("typed result helpers distinguish success and failure", () => {
    const ok = cryptoOk({ sealed: true });
    const fail = cryptoFail<string>(new CryptoError("crypto_decrypt_error"));

    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toEqual({ sealed: true });

    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error.code).toBe("crypto_decrypt_error");
  });
});
