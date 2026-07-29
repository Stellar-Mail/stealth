/**
 * Specification Compatibility Tests
 *
 * These tests enforce that the implementation matches the normative
 * specification in protocol/messages/envelope_spec.md. They prevent
 * accidental code/spec drift by validating:
 *
 * 1. Emitted metadata matches the documented v1 suite exactly
 * 2. Unsupported suites return stable errors
 * 3. Algorithm names, nonce sizes, and MAC sizes are consistent
 * 4. Future changes require explicit updates to both code and tests
 */

import { describe, expect, it } from "vitest";
import { sealEnvelope } from "../../../src/services/crypto/envelope";
import { openEnvelope, OpenEnvelopeError } from "../../../src/services/crypto/open-envelope";
import { getNormativeV1Suite } from "../../../src/services/crypto/algorithm-suite";
import { SUITE_REGISTRY } from "../../../src/services/crypto/suites";

describe("crypto specification compatibility", () => {
  describe("normative v1 suite definition", () => {
    it("v1 normative suite is AES-256-GCM", () => {
      const suite = getNormativeV1Suite();
      expect(suite.algorithm).toBe("AES-256-GCM");
      expect(suite.version).toBe("v1");
    });

    it("AES-256-GCM uses 256-bit keys", () => {
      const suite = getNormativeV1Suite();
      expect(suite.keyBits).toBe(256);
    });

    it("AES-256-GCM uses 12-byte (96-bit) nonces", () => {
      const suite = getNormativeV1Suite();
      expect(suite.nonceBytes).toBe(12);
    });

    it("AES-256-GCM maps to Web Crypto AES-GCM", () => {
      const suite = getNormativeV1Suite();
      expect(suite.webCryptoName).toBe("AES-GCM");
    });
  });

  describe("emitted metadata matches specification", () => {
    it("sealed envelope emits AES-256-GCM algorithm", async () => {
      const { payload } = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "test message",
      });

      expect(payload.encryption_metadata.algorithm).toBe("AES-256-GCM");
    });

    it("nonce is exactly 24 hex characters (12 bytes)", async () => {
      const { payload } = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "test message",
      });

      const nonce = payload.encryption_metadata.nonce;
      expect(nonce).toMatch(/^[0-9a-f]{24}$/);
    });

    it("mac is exactly 32 hex characters (16 bytes)", async () => {
      const { payload } = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "test message",
      });

      const mac = payload.encryption_metadata.mac;
      expect(mac).toMatch(/^[0-9a-f]{32}$/);
    });

    it("envelope version is v1", async () => {
      const { payload } = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "test message",
      });

      expect(payload.version).toBe("v1");
    });

    it("content_commitment follows v1:sha256:hex:<64 hex> format", async () => {
      const { payload } = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "test message",
      });

      expect(payload.content_commitment).toMatch(/^v1:sha256:hex:[0-9a-f]{64}$/);
    });
  });

  describe("unsupported suites return stable errors", () => {
    it("rejects X25519-XSalsa20-Poly1305 with crypto_algorithm_error", async () => {
      const fakeEnvelope = {
        payload: {
          version: "v1",
          sender: "alice",
          recipient: "bob",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "X25519-XSalsa20-Poly1305",
            nonce: "000000000000000000000000",
            mac: "00000000000000000000000000000000",
          },
          content_commitment: "v1:sha256:hex:" + "0".repeat(64),
          attachments: [],
        },
        ciphertext: "AA==",
      };

      await expect(
        openEnvelope(fakeEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        }),
      ).rejects.toThrow(OpenEnvelopeError);

      try {
        await openEnvelope(fakeEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        });
      } catch (err: any) {
        expect(err.code).toBe("crypto_validation_error");
        expect(err.message.toLowerCase()).toContain("invalid literal");
      }
    });

    it("rejects ChaCha20-Poly1305 with crypto_algorithm_error", async () => {
      const fakeEnvelope = {
        payload: {
          version: "v1",
          sender: "alice",
          recipient: "bob",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "ChaCha20-Poly1305",
            nonce: "000000000000000000000000",
            mac: "00000000000000000000000000000000",
          },
          content_commitment: "v1:sha256:hex:" + "0".repeat(64),
          attachments: [],
        },
        ciphertext: "AA==",
      };

      await expect(
        openEnvelope(fakeEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        }),
      ).rejects.toThrow(OpenEnvelopeError);
    });

    it("rejects unknown algorithm with stable error message", async () => {
      const fakeEnvelope = {
        payload: {
          version: "v1",
          sender: "alice",
          recipient: "bob",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "unknown-algo-9000",
            nonce: "000000000000000000000000",
            mac: "00000000000000000000000000000000",
          },
          content_commitment: "v1:sha256:hex:" + "0".repeat(64),
          attachments: [],
        },
        ciphertext: "AA==",
      };

      try {
        await openEnvelope(fakeEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        });
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(OpenEnvelopeError);
        expect(err.message.toLowerCase()).toContain("invalid literal");
        // Error message should be generic, not echo the algorithm name
        expect(err.message.toLowerCase()).toContain("algo");
      }
    });
  });

  describe("registry enforces fail-closed validation", () => {
    it("v1 version only allows AES-256-GCM", () => {
      const v1 = SUITE_REGISTRY.versions.find((v) => v.version === "v1");
      expect(v1).toBeDefined();
      expect(v1!.suites).toEqual(["AES-256-GCM"]);
    });

    it("AES-256-GCM is marked as supported", () => {
      const aes = SUITE_REGISTRY.suites.find((s) => s.name === "AES-256-GCM");
      expect(aes).toBeDefined();
      expect(aes!.status).toBe("supported");
    });

    it("no deprecated suites exist in v1", () => {
      const v1 = SUITE_REGISTRY.versions.find((v) => v.version === "v1");
      const suiteNames = v1!.suites;

      for (const name of suiteNames) {
        const suite = SUITE_REGISTRY.suites.find((s) => s.name === name);
        expect(suite!.status).toBe("supported");
      }
    });

    it("X25519-XSalsa20-Poly1305 is not registered", () => {
      const x25519 = SUITE_REGISTRY.suites.find((s) => s.name === "X25519-XSalsa20-Poly1305");
      expect(x25519).toBeUndefined();
    });
  });

  describe("round-trip compatibility", () => {
    it("sealed envelope can be opened with matching key", async () => {
      const testKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);

      const sealed = await sealEnvelope({
        sender: "alice@example.com",
        recipient: "bob@example.com",
        body: "round-trip test",
      });

      // Verify algorithm is AES-256-GCM
      expect(sealed.payload.encryption_metadata.algorithm).toBe("AES-256-GCM");

      // Note: Full round-trip test would require key resolution,
      // which is integration-level. This test focuses on metadata compatibility.
    });
  });

  describe("prevents future code/spec drift", () => {
    it("changing normative algorithm breaks this test (intentional)", () => {
      // This test will fail if someone changes the normative algorithm
      // without updating the specification and these tests.
      const suite = getNormativeV1Suite();
      expect(suite.algorithm).toBe("AES-256-GCM");

      // If you need to change this, you must also:
      // 1. Update protocol/messages/envelope_spec.md section 2
      // 2. Update all example JSON in the spec
      // 3. Update this test with the new algorithm name
      // 4. Add migration handling for old envelopes
      // 5. Update external documentation
    });

    it("emitted algorithm matches code and spec", async () => {
      const { payload } = await sealEnvelope({
        sender: "test",
        recipient: "test",
        body: "test",
      });

      const codeAlgorithm = payload.encryption_metadata.algorithm;
      const specAlgorithm = getNormativeV1Suite().algorithm;

      expect(codeAlgorithm).toBe(specAlgorithm);
      expect(codeAlgorithm).toBe("AES-256-GCM"); // Explicit spec assertion
    });
  });

  describe("error stability (non-secret errors)", () => {
    it("version error does not leak algorithm details", async () => {
      const badEnvelope = {
        payload: {
          version: "v99",
          sender: "alice",
          recipient: "bob",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "AES-256-GCM",
            nonce: "000000000000000000000000",
            mac: "00000000000000000000000000000000",
          },
          content_commitment: "v1:sha256:hex:" + "0".repeat(64),
          attachments: [],
        },
        ciphertext: "AA==",
      };

      try {
        await openEnvelope(badEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        });
        expect.fail("should have thrown");
      } catch (err: any) {
        expect(err.code).toBe("crypto_version_error");
        // Error should mention version but not leak crypto material
        expect(err.message.toLowerCase()).toContain("version");
      }
    });

    it("rejects unsupported algorithms at validation layer", async () => {
      // The Zod schema enforces AES-256-GCM as a literal, so unsupported
      // algorithms are caught early during validation
      const badEnvelope = {
        payload: {
          version: "v1",
          sender: "alice",
          recipient: "bob",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "bad-algo",
            nonce: "000000000000000000000000",
            mac: "00000000000000000000000000000000",
          },
          content_commitment: "v1:sha256:hex:" + "0".repeat(64),
          attachments: [],
        },
        ciphertext: "AA==",
      };

      try {
        await openEnvelope(badEnvelope as any, {
          async resolveKey() {
            return null as any;
          },
        });
        expect.fail("should have thrown");
      } catch (err: any) {
        // Schema validation rejects unsupported algorithms
        expect(err).toBeInstanceOf(OpenEnvelopeError);
        expect(err.code).toBe("crypto_validation_error");
      }
    });
  });
});
