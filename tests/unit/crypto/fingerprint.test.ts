import { describe, expect, it } from "vitest";
import {
  deriveEnvelopeFingerprint,
  checkReplay,
  type ReplayStore,
} from "../../../src/services/crypto/fingerprint";
import { type SealedEnvelope } from "../../../src/services/crypto/envelope";

const validPayload = {
  version: "v1" as const,
  sender: "GABC",
  recipient: "GXYZ",
  timestamp: "2026-07-24T12:00:00.000Z",
  encryption_metadata: {
    algorithm: "AES-256-GCM" as const,
    nonce: "0102030405060708090a0b0c",
    mac: "0102030405060708090a0b0c0d0e0f10",
  },
  content_commitment:
    "v1:sha256:hex:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
  attachments: [],
};

const validEnvelope: SealedEnvelope = {
  payload: validPayload,
  ciphertext: "SGVsbG8gV29ybGQ=", // valid base64
};

class InMemoryReplayStore implements ReplayStore {
  private seen = new Set<string>();

  has(fingerprint: string): boolean {
    return this.seen.has(fingerprint);
  }

  add(fingerprint: string): void {
    this.seen.add(fingerprint);
  }
}

describe("Envelope Fingerprinting & Replay Detection", () => {
  describe("deriveEnvelopeFingerprint", () => {
    it("is completely deterministic (same envelope produces identical fingerprint)", async () => {
      const fp1 = await deriveEnvelopeFingerprint(validEnvelope);
      const fp2 = await deriveEnvelopeFingerprint(validEnvelope);

      expect(fp1).toBe(fp2);
      expect(fp1).toMatch(/^v1:fp:sha256:[0-9a-f]{64}$/);
    });

    it("produces different fingerprints for meaningful changes in protected fields", async () => {
      const baseFp = await deriveEnvelopeFingerprint(validEnvelope);

      // 1. Change sender
      const fpSender = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: { ...validPayload, sender: "GOTHER" },
      });
      expect(fpSender).not.toBe(baseFp);

      // 2. Change recipient
      const fpRecipient = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: { ...validPayload, recipient: "GOTHER" },
      });
      expect(fpRecipient).not.toBe(baseFp);

      // 3. Change timestamp
      const fpTime = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: { ...validPayload, timestamp: "2026-07-24T12:00:01.000Z" },
      });
      expect(fpTime).not.toBe(baseFp);

      // 4. Change nonce
      const fpNonce = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: {
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            nonce: "ffffffffffffffffffffffff",
          },
        },
      });
      expect(fpNonce).not.toBe(baseFp);

      // 5. Change mac
      const fpMac = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: {
          ...validPayload,
          encryption_metadata: {
            ...validPayload.encryption_metadata,
            mac: "ffffffffffffffffffffffffffffffff",
          },
        },
      });
      expect(fpMac).not.toBe(baseFp);

      // 6. Change content commitment
      const fpCommitment = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        payload: {
          ...validPayload,
          content_commitment: "v1:sha256:hex:" + "f".repeat(64),
        },
      });
      expect(fpCommitment).not.toBe(baseFp);

      // 7. Change ciphertext
      const fpCiphertext = await deriveEnvelopeFingerprint({
        ...validEnvelope,
        ciphertext: "SGVsbG8gV29ybGQya2M=",
      });
      expect(fpCiphertext).not.toBe(baseFp);
    });

    it("does not include plaintext in the fingerprint string", async () => {
      const plaintext = "super-secret-plaintext-message-content";
      const fp = await deriveEnvelopeFingerprint(validEnvelope);

      expect(fp).not.toContain(plaintext);
      expect(fp).not.toContain(atob(validEnvelope.ciphertext));
    });

    it("rejects invalid envelope structures with schema validation errors", async () => {
      const invalidEnvelope = {
        ...validEnvelope,
        ciphertext: "not-base64-!!!",
      };

      await expect(deriveEnvelopeFingerprint(invalidEnvelope as any)).rejects.toThrow();
    });
  });

  describe("checkReplay", () => {
    it("detects replays correctly when checkReplay is invoked", async () => {
      const store = new InMemoryReplayStore();
      const fp = await deriveEnvelopeFingerprint(validEnvelope);

      // First check: should not be a replay, and should add to store
      const isReplay1 = await checkReplay(fp, store);
      expect(isReplay1).toBe(false);

      // Second check: should now be a replay
      const isReplay2 = await checkReplay(fp, store);
      expect(isReplay2).toBe(true);
    });
  });
});
