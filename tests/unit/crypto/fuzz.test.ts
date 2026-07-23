import { describe, expect, it } from "vitest";
import {
  openEnvelope,
  OpenEnvelopeError,
  MAX_CIPHERTEXT_BASE64_LENGTH,
  MAX_FIELD_STRING_LENGTH,
  MAX_ATTACHMENTS_COUNT,
  MAX_RAW_INPUT_STRING_LENGTH,
  type KeyProvider,
} from "../../../src/services/crypto/open-envelope";
import { createCommitment } from "../../../src/services/crypto/commitment";
import { CryptoError } from "../../../src/services/crypto/errors";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildValidEnvelope(body: string, key: CryptoKey, recipient = "GABC") {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(body);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
  const tag = ct.slice(ct.length - 16);
  const commitment = await createCommitment(ct);
  return {
    payload: {
      version: "v1",
      sender: "GABC",
      recipient,
      timestamp: new Date().toISOString(),
      encryption_metadata: {
        algorithm: "AES-256-GCM",
        nonce: toHex(iv),
        mac: toHex(tag),
      },
      content_commitment: commitment,
      attachments: [
        {
          filename: "test.txt",
          content_type: "text/plain",
          size_bytes: 100,
          content_hash: "a".repeat(64),
        },
      ],
    },
    ciphertext: toBase64(ct),
  };
}

function keyProviderFor(key: CryptoKey, recipient = "GABC"): KeyProvider {
  return {
    resolveKey: async (r) => {
      if (r !== recipient) throw new Error("Key unavailable for recipient");
      return key;
    },
  };
}

describe("Bounded Fuzz Testing - Encrypted Envelope Parsing (#1724)", () => {
  it("enforces static exported limit constants", () => {
    expect(MAX_CIPHERTEXT_BASE64_LENGTH).toBe(10 * 1024 * 1024);
    expect(MAX_FIELD_STRING_LENGTH).toBe(8192);
    expect(MAX_ATTACHMENTS_COUNT).toBe(100);
    expect(MAX_RAW_INPUT_STRING_LENGTH).toBe(15 * 1024 * 1024);
  });

  describe("Fixed CI Hostile Fuzz Corpus", () => {
    const fixedCorpus: Array<{ name: string; input: unknown }> = [
      { name: "null input", input: null },
      { name: "undefined input", input: undefined },
      { name: "number primitive", input: 12345 },
      { name: "boolean primitive", input: true },
      { name: "empty object", input: {} },
      { name: "empty array", input: [] },
      { name: "array of objects", input: [{ payload: {} }] },
      { name: "malformed JSON string", input: "{ bad json: true " },
      { name: "JSON string null", input: "null" },
      { name: "JSON string array", input: "[1, 2, 3]" },
      { name: "missing ciphertext", input: { payload: { version: "v1" } } },
      { name: "missing payload", input: { ciphertext: "AAAA" } },
      { name: "non-string ciphertext", input: { payload: {}, ciphertext: 12345 } },
      { name: "boolean payload", input: { payload: true, ciphertext: "AAAA" } },
      { name: "unsupported envelope version v0", input: { payload: { version: "v0" }, ciphertext: "AAAA" } },
      { name: "unsupported envelope version v2", input: { payload: { version: "v2" }, ciphertext: "AAAA" } },
      { name: "unsupported envelope version number", input: { payload: { version: 1 }, ciphertext: "AAAA" } },
      { name: "empty string sender", input: { payload: { version: "v1", sender: "", recipient: "B", timestamp: "T" }, ciphertext: "AAAA" } },
      { name: "invalid algorithm", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-128-CBC", nonce: "00", mac: "00" },
          content_commitment: "v1:sha256:hex:aa",
        },
        ciphertext: "AAAA",
      }},
      { name: "invalid hex nonce", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "NOT-HEX", mac: "00" },
          content_commitment: "v1:sha256:hex:aa",
        },
        ciphertext: "AAAA",
      }},
      { name: "invalid base64 ciphertext", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00".repeat(12), mac: "00".repeat(16) },
          content_commitment: "v1:sha256:hex:aa",
        },
        ciphertext: "!!!NOT_BASE64!!!",
      }},
      { name: "proto pollution attempt", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00".repeat(12), mac: "00".repeat(16) },
          content_commitment: "v1:sha256:hex:aa",
          __proto__: { admin: true },
          constructor: { prototype: { poll: true } },
        },
        ciphertext: "AAAA",
      }},
      { name: "excessive attachments array", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00".repeat(12), mac: "00".repeat(16) },
          content_commitment: "v1:sha256:hex:aa",
          attachments: Array.from({ length: 150 }, () => ({
            filename: "f.txt",
            content_type: "text/plain",
            size_bytes: 1,
            content_hash: "a".repeat(64),
          })),
        },
        ciphertext: "AAAA",
      }},
      { name: "invalid attachment item (non-object)", input: {
        payload: {
          version: "v1",
          sender: "A",
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00".repeat(12), mac: "00".repeat(16) },
          content_commitment: "v1:sha256:hex:aa",
          attachments: ["not-an-attachment-object"],
        },
        ciphertext: "AAAA",
      }},
      { name: "oversized string field", input: {
        payload: {
          version: "v1",
          sender: "A".repeat(10000),
          recipient: "B",
          timestamp: "T",
          encryption_metadata: { algorithm: "AES-256-GCM", nonce: "00".repeat(12), mac: "00".repeat(16) },
          content_commitment: "v1:sha256:hex:aa",
        },
        ciphertext: "AAAA",
      }},
      { name: "oversized raw input string", input: "x".repeat(16 * 1024 * 1024) },
    ];

    it.each(fixedCorpus)("safely rejects hostile input: $name", async ({ input }) => {
      const dummyKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const keys = keyProviderFor(dummyKey);

      await expect(openEnvelope(input, keys)).rejects.toSatisfy((err) => {
        return err instanceof OpenEnvelopeError || err instanceof CryptoError;
      });
    });
  });

  describe("Resource Limit Boundary Enforcement", () => {
    it("rejects ciphertext exceeding MAX_CIPHERTEXT_BASE64_LENGTH before decoding", async () => {
      const dummyKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const oversizedBase64 = "A".repeat(MAX_CIPHERTEXT_BASE64_LENGTH + 10);
      const input = {
        payload: {
          version: "v1",
          sender: "GABC",
          recipient: "GABC",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "AES-256-GCM",
            nonce: "00".repeat(12),
            mac: "00".repeat(16),
          },
          content_commitment: "v1:sha256:hex:00",
        },
        ciphertext: oversizedBase64,
      };

      const start = performance.now();
      const err = await openEnvelope(input, keyProviderFor(dummyKey)).catch((e) => e);
      const duration = performance.now() - start;

      expect(err).toBeInstanceOf(OpenEnvelopeError);
      expect((err as OpenEnvelopeError).code).toBe("crypto_validation_error");
      expect(duration).toBeLessThan(100); // Must fail fast
    });

    it("rejects oversized field strings quickly", async () => {
      const dummyKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const input = {
        payload: {
          version: "v1",
          sender: "A".repeat(MAX_FIELD_STRING_LENGTH + 1),
          recipient: "GABC",
          timestamp: new Date().toISOString(),
          encryption_metadata: {
            algorithm: "AES-256-GCM",
            nonce: "00".repeat(12),
            mac: "00".repeat(16),
          },
          content_commitment: "v1:sha256:hex:00",
        },
        ciphertext: "AAAA",
      };

      const err = await openEnvelope(input, keyProviderFor(dummyKey)).catch((e) => e);
      expect(err).toBeInstanceOf(OpenEnvelopeError);
      expect((err as OpenEnvelopeError).code).toBe("crypto_validation_error");
    });
  });

  describe("Bounded Pseudo-Random Mutation Fuzzing (100 iterations)", () => {
    it("handles 100 mutated inputs without crashing or throwing untyped errors", async () => {
      const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const validEnvelope = await buildValidEnvelope("fuzz baseline body", key, "GABC");
      const keys = keyProviderFor(key, "GABC");

      // Simple deterministic LCG random generator for reproducible test runs
      let seed = 42;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      const mutators: Array<(env: any) => any> = [
        // 1. Corrupt version
        (env) => ({ ...env, payload: { ...env.payload, version: "v99" } }),
        // 2. Corrupt sender string
        (env) => ({ ...env, payload: { ...env.payload, sender: 12345 } }),
        // 3. Corrupt recipient
        (env) => ({ ...env, payload: { ...env.payload, recipient: null } }),
        // 4. Truncate ciphertext
        (env) => ({ ...env, ciphertext: env.ciphertext.slice(0, 4) }),
        // 5. Flip bits in ciphertext
        (env) => {
          const chars = env.ciphertext.split("");
          chars[Math.floor(nextRandom() * chars.length)] = "#";
          return { ...env, ciphertext: chars.join("") };
        },
        // 6. Corrupt MAC hex
        (env) => ({
          ...env,
          payload: {
            ...env.payload,
            encryption_metadata: { ...env.payload.encryption_metadata, mac: "ff".repeat(16) },
          },
        }),
        // 7. Corrupt Nonce hex
        (env) => ({
          ...env,
          payload: {
            ...env.payload,
            encryption_metadata: { ...env.payload.encryption_metadata, nonce: "badhex" },
          },
        }),
        // 8. Corrupt commitment string
        (env) => ({
          ...env,
          payload: { ...env.payload, content_commitment: "v1:sha256:hex:baddeadbeef" },
        }),
        // 9. Add bad attachments
        (env) => ({
          ...env,
          payload: { ...env.payload, attachments: [{ filename: 123, size_bytes: -5 }] },
        }),
        // 10. Stringify and inject invalid syntax
        (env) => JSON.stringify(env).slice(0, -5),
      ];

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const mutator = mutators[i % mutators.length];
        const mutated = mutator(structuredClone(validEnvelope));

        const promise = openEnvelope(mutated, keys);
        await expect(promise).rejects.toSatisfy((err) => {
          return err instanceof OpenEnvelopeError || err instanceof CryptoError;
        });
      }

      const totalTime = performance.now() - startTime;
      // Normal CI suite fuzz execution must run within a bounded duration (<2 seconds for 100 iterations)
      expect(totalTime).toBeLessThan(2000);
    });
  });
});
