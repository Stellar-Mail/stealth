import { describe, expect, it } from "vitest";
import {
  sealedEnvelopeSchema,
  envelopeSignatureSchema,
  envelopePayloadSchema,
} from "../../../src/services/crypto/schema";

const validPayload = {
  version: "v1",
  sender: "GABC",
  recipient: "GXYZ",
  timestamp: "2026-07-24T12:00:00.000Z",
  encryption_metadata: {
    algorithm: "AES-256-GCM" as const,
    nonce: "0102030405060708090a0b0c", // 24 hex
    mac: "0102030405060708090a0b0c0d0e0f10", // 32 hex
  },
  content_commitment:
    "v1:sha256:hex:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
  attachments: [],
};

const validEnvelope = {
  payload: validPayload,
  ciphertext: "SGVsbG8gV29ybGQ=", // valid base64
};

const validSignature = {
  scheme: "Ed25519" as const,
  signerAddress: "GABC",
  value: "a".repeat(128), // 128 hex characters
};

describe("Crypto Schema Validation", () => {
  describe("sealedEnvelopeSchema", () => {
    it("successfully parses a valid envelope", () => {
      const parsed = sealedEnvelopeSchema.parse(validEnvelope);
      expect(parsed).toBeDefined();
      expect(parsed.payload.version).toBe("v1");
    });

    it("rejects an envelope with missing payload or ciphertext", () => {
      expect(() => sealedEnvelopeSchema.parse({ payload: validPayload })).toThrow();
      expect(() => sealedEnvelopeSchema.parse({ ciphertext: "SGVsbG8=" })).toThrow();
    });

    it("enforces base64 ciphertext bounds and formatting", () => {
      // ciphertext not base64
      expect(() =>
        sealedEnvelopeSchema.parse({
          ...validEnvelope,
          ciphertext: "not-base64-!!!",
        }),
      ).toThrow();

      // ciphertext too long
      const tooLongCiphertext = "A".repeat(25 * 1024 * 1024); // 25MB > 20MB limit
      expect(() =>
        sealedEnvelopeSchema.parse({
          ...validEnvelope,
          ciphertext: tooLongCiphertext,
        }),
      ).toThrow();
    });

    it("fails closed on unknown critical fields in payload", () => {
      // 1. Unknown fields that are NOT in critical should pass (passthrough)
      const payloadWithExt = {
        ...validPayload,
        custom_non_critical: "hello",
      };
      const parsed = sealedEnvelopeSchema.parse({
        ...validEnvelope,
        payload: payloadWithExt,
      });
      expect((parsed.payload as any).custom_non_critical).toBe("hello");

      // 2. Known field in critical should pass
      const payloadWithKnownCritical = {
        ...validPayload,
        critical: ["timestamp", "sender"],
      };
      expect(() =>
        sealedEnvelopeSchema.parse({
          ...validEnvelope,
          payload: payloadWithKnownCritical,
        }),
      ).not.toThrow();

      // 3. Unknown field in critical must fail closed
      const payloadWithUnknownCritical = {
        ...validPayload,
        custom_critical_field: "value",
        critical: ["custom_critical_field"],
      };
      expect(() =>
        sealedEnvelopeSchema.parse({
          ...validEnvelope,
          payload: payloadWithUnknownCritical,
        }),
      ).toThrow(/Unknown mandatory critical field/);
    });
  });

  describe("envelopePayloadSchema bounds and types", () => {
    it("enforces version length bounds", () => {
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          version: "",
        }),
      ).toThrow();

      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          version: "v1" + "0".repeat(20), // too long (>10)
        }),
      ).toThrow();
    });

    it("enforces address bounds", () => {
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          sender: "A".repeat(300), // too long (>256)
        }),
      ).toThrow();
    });

    it("enforces timestamp ISO 8601 validation and bounds", () => {
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          timestamp: "not-a-date",
        }),
      ).toThrow();

      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          timestamp: "2026-07-24T12:00:00Z" + "0".repeat(100), // too long (>64)
        }),
      ).toThrow();
    });

    it("enforces nonce hex format and strict 24-character bounds", () => {
      // Not 24 characters
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            nonce: "010203",
          },
        }),
      ).toThrow();

      // Not hex
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            nonce: "g".repeat(24),
          },
        }),
      ).toThrow();
    });

    it("enforces mac hex format and strict 32-character bounds", () => {
      // Not 32 characters
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            mac: "0102",
          },
        }),
      ).toThrow();

      // Not hex
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            mac: "z".repeat(32),
          },
        }),
      ).toThrow();
    });

    it("enforces content commitment format", () => {
      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          content_commitment: "invalid-format",
        }),
      ).toThrow();
    });

    it("enforces attachments validation bounds", () => {
      const tooManyAttachments = Array(101).fill({
        filename: "test.txt",
        content_type: "text/plain",
        size_bytes: 10,
        content_hash: "a".repeat(64),
      });

      expect(() =>
        envelopePayloadSchema.parse({
          ...validPayload,
          attachments: tooManyAttachments,
        }),
      ).toThrow();
    });
  });

  describe("envelopeSignatureSchema", () => {
    it("successfully parses a valid signature", () => {
      const parsed = envelopeSignatureSchema.parse(validSignature);
      expect(parsed).toBeDefined();
      expect(parsed.scheme).toBe("Ed25519");
    });

    it("rejects signatures with incorrect scheme", () => {
      expect(() =>
        envelopeSignatureSchema.parse({
          ...validSignature,
          scheme: "RSA" as any,
        }),
      ).toThrow();
    });

    it("rejects signatures with malformed or incorrect length values", () => {
      // Too short
      expect(() =>
        envelopeSignatureSchema.parse({
          ...validSignature,
          value: "aabbcc",
        }),
      ).toThrow();

      // Non-hex
      expect(() =>
        envelopeSignatureSchema.parse({
          ...validSignature,
          value: "g".repeat(128),
        }),
      ).toThrow();
    });
  });
});
