import { describe, expect, it } from "vitest";
import {
  getNormativeV1Suite,
  getAlgorithmSuiteDescription,
  assertNormativeAlgorithm,
  isNormativeV1Algorithm,
  ALGORITHM_SUITE_REGISTRY,
} from "../../../src/services/crypto/algorithm-suite";

describe("crypto/algorithm-suite", () => {
  describe("getNormativeV1Suite", () => {
    it("returns AES-256-GCM as the normative v1 algorithm", () => {
      const suite = getNormativeV1Suite();
      expect(suite.version).toBe("v1");
      expect(suite.algorithm).toBe("AES-256-GCM");
      expect(suite.keyBits).toBe(256);
      expect(suite.nonceBytes).toBe(12);
      expect(suite.webCryptoName).toBe("AES-GCM");
    });

    it("returns consistent result", () => {
      const suite1 = getNormativeV1Suite();
      const suite2 = getNormativeV1Suite();
      expect(suite1.algorithm).toBe(suite2.algorithm);
      expect(suite1.keyBits).toBe(suite2.keyBits);
      expect(suite1.nonceBytes).toBe(suite2.nonceBytes);
    });
  });

  describe("getAlgorithmSuiteDescription", () => {
    it("returns human-readable description", () => {
      const desc = getAlgorithmSuiteDescription();
      expect(desc).toContain("AES-256-GCM");
      expect(desc).toContain("256-bit");
      expect(desc).toContain("12-byte");
    });
  });

  describe("assertNormativeAlgorithm", () => {
    it("does not throw for AES-256-GCM", () => {
      expect(() => assertNormativeAlgorithm("AES-256-GCM")).not.toThrow();
    });

    it("throws for X25519-XSalsa20-Poly1305", () => {
      expect(() => assertNormativeAlgorithm("X25519-XSalsa20-Poly1305")).toThrow(
        /Unsupported algorithm.*X25519-XSalsa20-Poly1305/,
      );
    });

    it("throws for unknown algorithms", () => {
      expect(() => assertNormativeAlgorithm("AES-128-GCM")).toThrow(/Unsupported algorithm/);
      expect(() => assertNormativeAlgorithm("ChaCha20-Poly1305")).toThrow(/Unsupported algorithm/);
      expect(() => assertNormativeAlgorithm("plaintext")).toThrow(/Unsupported algorithm/);
    });

    it("error message mentions the normative algorithm", () => {
      try {
        assertNormativeAlgorithm("bad-algo");
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.message).toContain("AES-256-GCM");
        expect(err.message).toContain("normative v1 suite");
      }
    });
  });

  describe("isNormativeV1Algorithm", () => {
    it("returns true for AES-256-GCM", () => {
      expect(isNormativeV1Algorithm("AES-256-GCM")).toBe(true);
    });

    it("returns false for X25519-XSalsa20-Poly1305", () => {
      expect(isNormativeV1Algorithm("X25519-XSalsa20-Poly1305")).toBe(false);
    });

    it("returns false for unknown algorithms", () => {
      expect(isNormativeV1Algorithm("AES-128-GCM")).toBe(false);
      expect(isNormativeV1Algorithm("ChaCha20-Poly1305")).toBe(false);
      expect(isNormativeV1Algorithm("")).toBe(false);
    });
  });

  describe("ALGORITHM_SUITE_REGISTRY", () => {
    it("exposes the complete suite registry", () => {
      expect(ALGORITHM_SUITE_REGISTRY).toBeDefined();
      expect(ALGORITHM_SUITE_REGISTRY.versions).toBeDefined();
      expect(ALGORITHM_SUITE_REGISTRY.suites).toBeDefined();
    });

    it("contains at least the v1 version", () => {
      const v1 = ALGORITHM_SUITE_REGISTRY.versions.find((v) => v.version === "v1");
      expect(v1).toBeDefined();
      expect(v1!.status).toBe("supported");
    });

    it("contains AES-256-GCM suite", () => {
      const aes = ALGORITHM_SUITE_REGISTRY.suites.find((s) => s.name === "AES-256-GCM");
      expect(aes).toBeDefined();
      expect(aes!.status).toBe("supported");
      expect(aes!.keyBits).toBe(256);
      expect(aes!.nonceBytes).toBe(12);
    });
  });

  describe("normative suite consistency", () => {
    it("v1 version links to AES-256-GCM", () => {
      const v1 = ALGORITHM_SUITE_REGISTRY.versions.find((v) => v.version === "v1");
      expect(v1!.suites).toContain("AES-256-GCM");
    });

    it("AES-256-GCM is registered in suites array", () => {
      const suiteNames = ALGORITHM_SUITE_REGISTRY.suites.map((s) => s.name);
      expect(suiteNames).toContain("AES-256-GCM");
    });

    it("default suite matches normative v1 suite", () => {
      const normative = getNormativeV1Suite();
      const defaultSuite = ALGORITHM_SUITE_REGISTRY.suites.find((s) => s.name === "AES-256-GCM");
      expect(defaultSuite!.name).toBe(normative.algorithm);
      expect(defaultSuite!.keyBits).toBe(normative.keyBits);
      expect(defaultSuite!.nonceBytes).toBe(normative.nonceBytes);
    });
  });
});
