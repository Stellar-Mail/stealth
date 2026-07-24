import { describe, expect, it } from "vitest";
import {
  deriveKeyId,
  isKeyDecryptable,
  resolveKeysFromSet,
  selectBestKey,
  type KeyMetadata,
  type KeyRotationPolicy,
} from "../../../src/services/crypto/key-id";
import { sealEnvelope } from "../../../src/services/crypto/envelope";
import { openEnvelope, type KeyProvider } from "../../../src/services/crypto/open-envelope";
import { getCryptoTestVectors } from "../../../src/services/crypto/testing";

describe("Cryptographic Key Identifiers and Rotation Metadata", () => {
  describe("deriveKeyId", () => {
    it("derives key IDs deterministically from public keys", async () => {
      const pubKey1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const pubKey2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const pubKey3 = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);

      const id1 = await deriveKeyId(pubKey1);
      const id2 = await deriveKeyId(pubKey2);
      const id3 = await deriveKeyId(pubKey3);

      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id1.startsWith("kid_")).toBe(true);
      expect(id1).toMatch(/^kid_[0-9a-f]{64}$/); // SHA-256 hex is 64 chars
    });

    it("throws an error for empty public keys", async () => {
      await expect(deriveKeyId(new Uint8Array(0))).rejects.toThrow();
    });
  });

  describe("isKeyDecryptable", () => {
    const policy: KeyRotationPolicy = {
      allowRotatedKeys: true,
      allowExpiredKeysForDecryption: false,
    };

    it("allows active keys", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        rotationState: "active",
      };
      expect(isKeyDecryptable(key, policy)).toBe(true);
    });

    it("allows rotated keys if allowed by policy", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        rotationState: "rotated",
      };
      expect(isKeyDecryptable(key, policy)).toBe(true);
      expect(isKeyDecryptable(key, { ...policy, allowRotatedKeys: false })).toBe(false);
    });

    it("never allows revoked keys", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        rotationState: "revoked",
      };
      expect(isKeyDecryptable(key, policy)).toBe(false);
    });

    it("respects expiration time", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        expiresAt: "2026-07-23T13:00:00Z",
        rotationState: "active",
      };
      const refBefore = new Date("2026-07-23T12:30:00Z");
      const refAfter = new Date("2026-07-23T13:30:00Z");

      expect(isKeyDecryptable(key, policy, refBefore)).toBe(true);
      expect(isKeyDecryptable(key, policy, refAfter)).toBe(false);
    });

    it("respects grace periods", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        expiresAt: "2026-07-23T13:00:00Z",
        rotationState: "active",
      };
      const refExpiredButWithinGrace = new Date("2026-07-23T13:05:00Z");
      const refExpiredBeyondGrace = new Date("2026-07-23T13:15:00Z");

      const policyWithGrace: KeyRotationPolicy = {
        allowRotatedKeys: true,
        allowExpiredKeysForDecryption: false,
        gracePeriodSeconds: 600, // 10 minutes
      };

      expect(isKeyDecryptable(key, policyWithGrace, refExpiredButWithinGrace)).toBe(true);
      expect(isKeyDecryptable(key, policyWithGrace, refExpiredBeyondGrace)).toBe(false);
    });

    it("allows expired keys if explicitly configured in policy", () => {
      const key: KeyMetadata = {
        keyId: "kid_123",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        expiresAt: "2026-07-23T13:00:00Z",
        rotationState: "active",
      };
      const refAfter = new Date("2026-07-23T13:30:00Z");
      const laxPolicy: KeyRotationPolicy = {
        allowRotatedKeys: true,
        allowExpiredKeysForDecryption: true,
      };

      expect(isKeyDecryptable(key, laxPolicy, refAfter)).toBe(true);
    });
  });

  describe("resolveKeysFromSet and selectBestKey (Collisions)", () => {
    const policy: KeyRotationPolicy = {
      allowRotatedKeys: true,
    };

    const keys: KeyMetadata[] = [
      {
        keyId: "kid_collision",
        algorithm: "Ed25519",
        version: 1,
        createdAt: "2026-07-23T12:00:00Z",
        rotationState: "rotated",
      },
      {
        keyId: "kid_collision",
        algorithm: "Ed25519",
        version: 2,
        createdAt: "2026-07-23T12:30:00Z",
        rotationState: "active",
      },
      {
        keyId: "kid_collision",
        algorithm: "Ed25519",
        version: 3,
        createdAt: "2026-07-23T13:00:00Z",
        rotationState: "revoked",
      },
    ];

    it("resolves only non-revoked/decryptable keys matching keyId", () => {
      const resolved = resolveKeysFromSet("kid_collision", keys, policy);
      expect(resolved.length).toBe(2);
      expect(resolved.map((k) => k.version)).toContain(1);
      expect(resolved.map((k) => k.version)).toContain(2);
      expect(resolved.map((k) => k.version)).not.toContain(3);
    });

    it("selects the best key prioritizing active, then version, then creation time", () => {
      const resolved = resolveKeysFromSet("kid_collision", keys, policy);
      const best = selectBestKey(resolved);
      expect(best).toBeDefined();
      expect(best!.version).toBe(2); // Active takes precedence over version 3 (revoked) and version 1 (rotated)
    });

    it("prioritizes highest version if states are equal", () => {
      const candidates: KeyMetadata[] = [
        {
          keyId: "kid_collision",
          algorithm: "Ed25519",
          version: 1,
          createdAt: "2026-07-23T12:00:00Z",
          rotationState: "active",
        },
        {
          keyId: "kid_collision",
          algorithm: "Ed25519",
          version: 2,
          createdAt: "2026-07-23T11:00:00Z",
          rotationState: "active",
        },
      ];
      const best = selectBestKey(candidates);
      expect(best!.version).toBe(2);
    });
  });

  describe("Envelope Integration", () => {
    it("includes key identifiers in envelopes and preserves them upon decryption", async () => {
      const sender = "GBH47OC7S6S7G3G2P6P5H7P7K6J6J6J6J6J6J6J6J6J6J6J6J6J6J6J6";
      const recipient = "GBH47OC7S6S7G3G2P6P5H7P7K6J6J6J6J6J6J6J6J6J6J6J6J6J6J6J6";
      const body = "Test message body with key identifiers";

      const recipientKeyId = "kid_recipient_test";
      const senderKeyId = "kid_sender_test";

      // Use test vectors for deterministic key generation
      const vectors = getCryptoTestVectors();
      const mockKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      vectors.generateKey = async () => mockKey;

      const sealed = await sealEnvelope({
        sender,
        recipient,
        body,
        recipientKeyId,
        senderKeyId,
      });

      // Verify that key IDs are exposed in the metadata without leaking plaintext/private material
      expect(sealed.payload.encryption_metadata.recipient_key_id).toBe(recipientKeyId);
      expect(sealed.payload.encryption_metadata.sender_key_id).toBe(senderKeyId);

      // Verify that it doesn't leak in the ciphertext directly (it's in the plaintext body / payload metadata)
      expect(sealed.ciphertext).not.toContain(recipientKeyId);

      let resolvedKeyIdPassed: string | undefined;
      const keyProvider: KeyProvider = {
        async resolveKey(rec: string, kid?: string) {
          resolvedKeyIdPassed = kid;
          return mockKey;
        },
      };

      const opened = await openEnvelope(sealed, keyProvider);

      expect(opened.body).toBe(body);
      expect(opened.recipientKeyId).toBe(recipientKeyId);
      expect(opened.senderKeyId).toBe(senderKeyId);
      expect(resolvedKeyIdPassed).toBe(recipientKeyId);

      // Clean up test vectors
      vectors.generateKey = undefined;
    });
  });
});
