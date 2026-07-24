import { describe, expect, it } from "vitest";
import { CryptoError } from "../../../src/services/crypto/errors";
import {
  SUITE_REGISTRY,
  getVersion,
  getSuite,
  isSupportedVersion,
  isSupportedSuite,
  isSuiteForVersion,
  validateVersionAndSuite,
  validateVersionForOpen,
  validateSuiteForOpen,
  validateNegotiationForOpen,
  getDefaultSuite,
  getDefaultVersion,
  validateRegistryIntegrity,
} from "../../../src/services/crypto/suites";

describe("crypto suite registry", () => {
  describe("registry structure", () => {
    it("has at least one version and one suite", () => {
      expect(SUITE_REGISTRY.versions.length).toBeGreaterThanOrEqual(1);
      expect(SUITE_REGISTRY.suites.length).toBeGreaterThanOrEqual(1);
    });

    it("first suite is AES-256-GCM with correct parameters", () => {
      const aes = SUITE_REGISTRY.suites[0];
      expect(aes.name).toBe("AES-256-GCM");
      expect(aes.keyBits).toBe(256);
      expect(aes.nonceBytes).toBe(12);
      expect(aes.webCryptoName).toBe("AES-GCM");
      expect(aes.status).toBe("supported");
    });

    it("first version is v1 with AES-256-GCM", () => {
      const v1 = SUITE_REGISTRY.versions[0];
      expect(v1.version).toBe("v1");
      expect(v1.suites).toContain("AES-256-GCM");
      expect(v1.status).toBe("supported");
    });

    it("passes integrity check", () => {
      expect(() => validateRegistryIntegrity()).not.toThrow();
    });
  });

  describe("getVersion / getSuite", () => {
    it("returns the v1 version entry", () => {
      const v = getVersion("v1");
      expect(v).toBeDefined();
      expect(v!.version).toBe("v1");
      expect(v!.status).toBe("supported");
    });

    it("returns undefined for unknown version", () => {
      expect(getVersion("v99")).toBeUndefined();
      expect(getVersion("v0")).toBeUndefined();
      expect(getVersion("")).toBeUndefined();
    });

    it("returns the AES-256-GCM suite entry", () => {
      const s = getSuite("AES-256-GCM");
      expect(s).toBeDefined();
      expect(s!.name).toBe("AES-256-GCM");
      expect(s!.keyBits).toBe(256);
      expect(s!.nonceBytes).toBe(12);
      expect(s!.webCryptoName).toBe("AES-GCM");
    });

    it("returns undefined for unknown suite", () => {
      expect(getSuite("AES-128-GCM")).toBeUndefined();
      expect(getSuite("ChaCha20-Poly1305")).toBeUndefined();
      expect(getSuite("ROT13")).toBeUndefined();
      expect(getSuite("")).toBeUndefined();
    });
  });

  describe("isSupportedVersion", () => {
    it("returns true for v1", () => {
      expect(isSupportedVersion("v1")).toBe(true);
    });

    it("returns false for unknown versions", () => {
      expect(isSupportedVersion("v0")).toBe(false);
      expect(isSupportedVersion("v2")).toBe(false);
      expect(isSupportedVersion("v99")).toBe(false);
      expect(isSupportedVersion("")).toBe(false);
    });
  });

  describe("isSupportedSuite", () => {
    it("returns true for AES-256-GCM", () => {
      expect(isSupportedSuite("AES-256-GCM")).toBe(true);
    });

    it("returns false for unregistered suites", () => {
      expect(isSupportedSuite("AES-128-GCM")).toBe(false);
      expect(isSupportedSuite("ChaCha20-Poly1305")).toBe(false);
      expect(isSupportedSuite("XOR")).toBe(false);
      expect(isSupportedSuite("")).toBe(false);
    });
  });

  describe("isSuiteForVersion", () => {
    it("returns true for AES-256-GCM on v1", () => {
      expect(isSuiteForVersion("AES-256-GCM", "v1")).toBe(true);
    });

    it("returns false when suite is not registered for the version", () => {
      expect(isSuiteForVersion("AES-128-GCM", "v1")).toBe(false);
    });

    it("returns false when version is unknown", () => {
      expect(isSuiteForVersion("AES-256-GCM", "v99")).toBe(false);
    });

    it("returns false when both are unknown", () => {
      expect(isSuiteForVersion("XOR", "v99")).toBe(false);
    });
  });

  describe("validateVersionAndSuite (seal path — strict)", () => {
    it("does not throw for v1 + AES-256-GCM", () => {
      expect(() => validateVersionAndSuite("v1", "AES-256-GCM")).not.toThrow();
    });

    it("throws crypto_version_error for unknown version", () => {
      try {
        validateVersionAndSuite("v2", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });

    it("throws crypto_version_error for deprecated version", () => {
      try {
        validateVersionAndSuite("v0", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });

    it("throws crypto_algorithm_error for unknown suite", () => {
      try {
        validateVersionAndSuite("v1", "AES-128-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });

    it("throws crypto_algorithm_error for deprecated suite", () => {
      try {
        validateVersionAndSuite("v1", "ROT13");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });

    it("throws crypto_algorithm_error for suite not in version", () => {
      try {
        validateVersionAndSuite("v1", "ChaCha20-Poly1305");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });
  });

  describe("validateVersionForOpen (open path — accepts deprecated)", () => {
    it("does not throw for v1", () => {
      expect(() => validateVersionForOpen("v1")).not.toThrow();
    });

    it("throws crypto_version_error for unknown version", () => {
      try {
        validateVersionForOpen("v99");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });
  });

  describe("validateSuiteForOpen (open path — accepts deprecated)", () => {
    it("does not throw for AES-256-GCM", () => {
      expect(() => validateSuiteForOpen("AES-256-GCM")).not.toThrow();
    });

    it("throws crypto_algorithm_error for unknown suite", () => {
      try {
        validateSuiteForOpen("XOR");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });
  });

  describe("validateNegotiationForOpen (open path — pair check)", () => {
    it("does not throw for v1 + AES-256-GCM", () => {
      expect(() => validateNegotiationForOpen("v1", "AES-256-GCM")).not.toThrow();
    });

    it("throws crypto_version_error for unknown version", () => {
      try {
        validateNegotiationForOpen("v99", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });

    it("throws crypto_algorithm_error for unknown suite", () => {
      try {
        validateNegotiationForOpen("v1", "XOR");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });

    it("throws crypto_algorithm_error for unregistered pair", () => {
      try {
        validateNegotiationForOpen("v1", "ChaCha20-Poly1305");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });
  });

  describe("getDefaultSuite", () => {
    it("returns AES-256-GCM", () => {
      const suite = getDefaultSuite();
      expect(suite.name).toBe("AES-256-GCM");
      expect(suite.keyBits).toBe(256);
      expect(suite.nonceBytes).toBe(12);
      expect(suite.webCryptoName).toBe("AES-GCM");
      expect(suite.status).toBe("supported");
    });
  });

  describe("getDefaultVersion", () => {
    it("returns v1", () => {
      expect(getDefaultVersion()).toBe("v1");
    });
  });

  describe("downgrade protection", () => {
    it("rejects version downgrade from v1 to v0", () => {
      try {
        validateVersionAndSuite("v0", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });

    it("rejects suite downgrade from AES-256-GCM to AES-128-GCM", () => {
      try {
        validateVersionAndSuite("v1", "AES-128-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });

    it("rejects arbitrary algorithm injection", () => {
      try {
        validateVersionAndSuite("v1", "plaintext");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_algorithm_error");
      }
    });

    it("rejects future version with current suite", () => {
      try {
        validateVersionAndSuite("v2", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CryptoError);
        expect((err as CryptoError).code).toBe("crypto_version_error");
      }
    });
  });

  describe("error messages are stable and non-secret", () => {
    it("version error message does not leak details", () => {
      try {
        validateVersionAndSuite("v2", "AES-256-GCM");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as CryptoError).message).not.toContain("v2");
        expect((err as CryptoError).message).not.toContain("AES");
      }
    });

    it("algorithm error message does not leak details", () => {
      try {
        validateVersionAndSuite("v1", "secret-key-material");
        expect.fail("should have thrown");
      } catch (err) {
        expect((err as CryptoError).message).not.toContain("secret");
        expect((err as CryptoError).message).not.toContain("key");
      }
    });
  });
});
