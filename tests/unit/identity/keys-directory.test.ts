import { describe, expect, it, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  publishKey,
  rotateKey,
  retireKey,
  revokeKey,
  getKeyDirectory,
  getKey,
} from "../../../src/server/api/key-directory-service";
import {
  buildKeyPublicationSigningPayload,
  verifyKeyPublicationSignature,
  isKeyValidAtTimestamp,
  type PublishedKey,
} from "../../../src/features/identity/keys";
import {
  DirectoryRecipientKeyResolver,
  resolveTrustedKey,
  validateHistoricalKey,
  ResolverError,
} from "../../../src/services/crypto/key-resolver";
import { ApiError } from "../../../src/server/api/errors";

describe("BETA-027 (Issue #1934): Versioned Public Key Directory and Rotation API", () => {
  let repository: MemoryApiRepository;
  let aliceKp: Keypair;
  let bobKp: Keypair;
  let aliceAddress: string;
  let bobAddress: string;

  beforeEach(() => {
    repository = new MemoryApiRepository();
    aliceKp = Keypair.random();
    bobKp = Keypair.random();
    aliceAddress = aliceKp.publicKey();
    bobAddress = bobKp.publicKey();
  });

  function signPayload(kp: Keypair, payload: Uint8Array): string {
    const sigBuffer = kp.sign(Buffer.from(payload));
    return sigBuffer.toString("base64");
  }

  describe("1. Key Publication & Signature Verification", () => {
    it("successfully publishes a signed public encryption key", async () => {
      const keyId = "k_alice_enc_1";
      const notBefore = new Date(Date.now() - 1000).toISOString();
      const notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const pubKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const payload = buildKeyPublicationSigningPayload({
        owner: aliceAddress,
        keyId,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey,
        version: 1,
        notBefore,
        notAfter,
        operation: "publish",
      });

      const signature = signPayload(aliceKp, payload);

      const published = await publishKey(repository, aliceAddress, {
        keyId,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey,
        notBefore,
        notAfter,
        signature,
        metadata: { client: "stealth-web/1.0" },
      });

      expect(published.keyId).toBe(keyId);
      expect(published.owner).toBe(aliceAddress);
      expect(published.version).toBe(1);
      expect(published.status).toBe("active");
      expect(published.signature).toBe(signature);

      // Verify directory reflects published key
      const dir = await getKeyDirectory(repository, aliceAddress);
      expect(dir.currentKeys.encryption?.keyId).toBe(keyId);
      expect(dir.version).toBe(1);
      expect(dir.allKeys).toHaveLength(1);
    });

    it("rejects publication with invalid or forged signature", async () => {
      const keyId = "k_forged_1";
      const notBefore = new Date().toISOString();
      const notAfter = new Date(Date.now() + 100000).toISOString();
      const pubKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

      const payload = buildKeyPublicationSigningPayload({
        owner: aliceAddress,
        keyId,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey,
        version: 1,
        notBefore,
        notAfter,
        operation: "publish",
      });

      // Bob signs Alice's key publication (forgery attempt)
      const invalidSignature = signPayload(bobKp, payload);

      await expect(
        publishKey(repository, aliceAddress, {
          keyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: pubKey,
          notBefore,
          notAfter,
          signature: invalidSignature,
        }),
      ).rejects.toThrowError(ApiError);
    });

    it("strictly rejects private key material or secrets in public key fields", async () => {
      const badSecret = aliceKp.secret(); // Stellar S... secret key
      const notBefore = new Date().toISOString();
      const notAfter = new Date(Date.now() + 100000).toISOString();

      await expect(
        publishKey(
          repository,
          aliceAddress,
          {
            keyId: "k_bad",
            algorithm: "ed25519",
            purpose: "signing",
            publicKey: badSecret,
            notBefore,
            notAfter,
            signature: "dummy",
          },
          { bypassSignatureCheck: true },
        ),
      ).rejects.toThrowError(/Private key material detected/);
    });
  });

  describe("2. Key Rotation with Overlap Window & Rollback Prevention", () => {
    it("rotates an active key, incrementing version and transitioning previous key to rotated", async () => {
      // Step 1: Publish Key v1
      const key1Id = "k_alice_v1";
      const notBefore1 = new Date(Date.now() - 10000).toISOString();
      const notAfter1 = new Date(Date.now() + 1000000).toISOString();
      const pubKey1 = "aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111aaaa1111";

      const payload1 = buildKeyPublicationSigningPayload({
        owner: aliceAddress,
        keyId: key1Id,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey1,
        version: 1,
        notBefore: notBefore1,
        notAfter: notAfter1,
        operation: "publish",
      });

      await publishKey(repository, aliceAddress, {
        keyId: key1Id,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey1,
        notBefore: notBefore1,
        notAfter: notAfter1,
        signature: signPayload(aliceKp, payload1),
      });

      // Step 2: Rotate to Key v2
      const key2Id = "k_alice_v2";
      const notBefore2 = new Date().toISOString();
      const notAfter2 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const pubKey2 = "bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222bbbb2222";

      const rotatePayload = buildKeyPublicationSigningPayload({
        owner: aliceAddress,
        keyId: key2Id,
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: pubKey2,
        version: 2, // monotonic increment
        notBefore: notBefore2,
        notAfter: notAfter2,
        operation: "rotate",
      });

      const rotationResult = await rotateKey(repository, aliceAddress, {
        currentKeyId: key1Id,
        newKey: {
          keyId: key2Id,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: pubKey2,
          notBefore: notBefore2,
          notAfter: notAfter2,
          signature: signPayload(aliceKp, rotatePayload),
        },
        overlapPeriodMs: 7 * 24 * 60 * 60 * 1000,
        signature: signPayload(aliceKp, rotatePayload),
      });

      expect(rotationResult.previous.keyId).toBe(key1Id);
      expect(rotationResult.previous.status).toBe("rotated");
      expect(rotationResult.current.keyId).toBe(key2Id);
      expect(rotationResult.current.status).toBe("active");
      expect(rotationResult.current.version).toBe(2);

      // Verify directory points to v2 as current encryption key
      const dir = await getKeyDirectory(repository, aliceAddress);
      expect(dir.currentKeys.encryption?.keyId).toBe(key2Id);
      expect(dir.historicalKeys).toHaveLength(1);
      expect(dir.historicalKeys[0].keyId).toBe(key1Id);
      expect(dir.historicalKeys[0].status).toBe("rotated");
    });

    it("rejects rotating a non-existent or foreign key", async () => {
      const fakeKeyId = "k_non_existent";
      const rotatePayload = buildKeyPublicationSigningPayload({
        owner: aliceAddress,
        keyId: "k_new",
        algorithm: "x25519",
        purpose: "encryption",
        publicKey: "0101010101010101010101010101010101010101010101010101010101010101",
        version: 2,
        notBefore: new Date().toISOString(),
        notAfter: new Date(Date.now() + 100000).toISOString(),
        operation: "rotate",
      });

      await expect(
        rotateKey(repository, aliceAddress, {
          currentKeyId: fakeKeyId,
          newKey: {
            keyId: "k_new",
            algorithm: "x25519",
            purpose: "encryption",
            publicKey: "0101010101010101010101010101010101010101010101010101010101010101",
            signature: signPayload(aliceKp, rotatePayload),
          },
          signature: signPayload(aliceKp, rotatePayload),
        }),
      ).rejects.toThrowError(ApiError);
    });
  });

  describe("3. Key Retirement & Revocation Lifecycle", () => {
    it("retires an active key cleanly", async () => {
      const keyId = "k_retire_me";
      await publishKey(
        repository,
        aliceAddress,
        {
          keyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          signature: "dummy",
        },
        { bypassSignatureCheck: true },
      );

      const retired = await retireKey(repository, aliceAddress, { keyId });
      expect(retired.status).toBe("retired");

      const dir = await getKeyDirectory(repository, aliceAddress);
      expect(dir.currentKeys.encryption).toBeNull();
      expect(dir.allKeys[0].status).toBe("retired");
    });

    it("revokes a key, immediately blocking encryption while permitting historical verification before revokedAt", async () => {
      const keyId = "k_revoke_me";
      const creationTime = new Date(Date.now() - 3600000); // 1 hour ago
      const notBefore = creationTime.toISOString();
      const notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      await publishKey(
        repository,
        aliceAddress,
        {
          keyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          notBefore,
          notAfter,
          signature: "dummy",
        },
        { bypassSignatureCheck: true },
      );

      // Revoke the key
      const revoked = await revokeKey(repository, aliceAddress, {
        keyId,
        reason: "Device compromised",
        signature: "dummy",
      });

      expect(revoked.status).toBe("revoked");
      expect(revoked.revocationReason).toBe("Device compromised");
      expect(revoked.revokedAt).toBeDefined();

      const revokedAt = new Date(revoked.revokedAt!);

      // Historical verification rules:
      // 1. Message sent 30 minutes before revocation -> VALID
      const pastMsgTimestamp = new Date(revokedAt.getTime() - 30 * 60 * 1000);
      expect(isKeyValidAtTimestamp(revoked, pastMsgTimestamp)).toBe(true);

      // 2. Message sent after revocation -> INVALID
      const futureMsgTimestamp = new Date(revokedAt.getTime() + 10 * 1000);
      expect(isKeyValidAtTimestamp(revoked, futureMsgTimestamp)).toBe(false);

      // 3. Current active encryption resolution fails
      const dir = await getKeyDirectory(repository, aliceAddress);
      expect(dir.currentKeys.encryption).toBeNull();
    });
  });

  describe("4. Cross-Account Authorization & Protection", () => {
    it("prevents Bob from modifying or revoking Alice's keys", async () => {
      const aliceKeyId = "k_alice_secret";
      await publishKey(
        repository,
        aliceAddress,
        {
          keyId: aliceKeyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          signature: "dummy",
        },
        { bypassSignatureCheck: true },
      );

      // Bob tries to revoke Alice's key
      await expect(
        revokeKey(repository, bobAddress, {
          keyId: aliceKeyId,
          reason: "malicious revocation",
          signature: "dummy",
        }),
      ).rejects.toThrowError(ApiError);

      // Bob tries to retire Alice's key
      await expect(
        retireKey(repository, bobAddress, {
          keyId: aliceKeyId,
        }),
      ).rejects.toThrowError(ApiError);
    });
  });

  describe("5. DirectoryRecipientKeyResolver Integration", () => {
    it("resolves active key via DirectoryRecipientKeyResolver", async () => {
      const keyId = "k_alice_active";
      const pubKey = "1122334455667788112233445566778811223344556677881122334455667788";

      await publishKey(
        repository,
        aliceAddress,
        {
          keyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: pubKey,
          signature: "dummy",
        },
        { bypassSignatureCheck: true },
      );

      const resolver = new DirectoryRecipientKeyResolver(async (owner) => {
        return getKeyDirectory(repository, owner);
      });

      const resolved = await resolveTrustedKey(resolver, aliceAddress);
      expect(resolved.recipient).toBe(aliceAddress);
      expect(resolved.keyId).toBe(keyId);
      expect(resolved.revoked).toBe(false);
      expect(resolved.provenance).toBe("trusted-directory");
    });

    it("resolves historical key and validates against message timestamps", async () => {
      const keyId = "k_alice_hist";
      const pubKey = "1122334455667788112233445566778811223344556677881122334455667788";
      const notBefore = new Date(Date.now() - 7200000).toISOString(); // 2 hours ago
      const notAfter = new Date(Date.now() + 3600000).toISOString();

      await publishKey(
        repository,
        aliceAddress,
        {
          keyId,
          algorithm: "x25519",
          purpose: "encryption",
          publicKey: pubKey,
          notBefore,
          notAfter,
          signature: "dummy",
        },
        { bypassSignatureCheck: true },
      );

      // Revoke the key 1 hour ago
      const revokedAt = new Date(Date.now() - 3600000);
      await revokeKey(repository, aliceAddress, {
        keyId,
        reason: "Test revocation",
        revokedAt: revokedAt.toISOString(),
        signature: "dummy",
      });

      const resolver = new DirectoryRecipientKeyResolver(async (owner) => {
        return getKeyDirectory(repository, owner);
      });

      // 1. Valid historical message timestamp (90 minutes ago, before revokedAt)
      const validTimestamp = new Date(Date.now() - 90 * 60 * 1000);
      const histKey = await resolver.resolveHistorical(aliceAddress, keyId, validTimestamp);
      expect(histKey.keyId).toBe(keyId);
      expect(histKey.revoked).toBe(true);

      // 2. Invalid historical message timestamp (postdates revokedAt)
      const invalidTimestamp = new Date(Date.now() - 10 * 60 * 1000);
      await expect(
        resolver.resolveHistorical(aliceAddress, keyId, invalidTimestamp),
      ).rejects.toThrowError(ResolverError);
    });
  });
});
