/**
 * BETA-085 (#1992) — Cryptography and managed-wallet misuse resistance umbrella.
 *
 * Exercises key exfiltration, tampered wrapped keys, wrong master version,
 * revoked recipients, memory cleanup, and fail-closed error taxonomy using
 * stable fixtures from tests/fixtures/crypto-misuse-corpus.json.
 */
import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import corpus from "../../fixtures/crypto-misuse-corpus.json";
import {
  ManagedWalletCryptoError,
  MemoryManagedWalletStore,
  VersionedMasterKeyProvider,
  sealManagedWalletSeed,
  withManagedWalletSeed,
  rewrapManagedWallet,
} from "../../../src/services/crypto/managed-wallet-envelope";
import {
  generateRecipientKeyPair,
  unwrapContentKey,
  wrapContentKey,
  type WrappedKeyEntry,
} from "../../../src/services/crypto/key-wrap";
import { recipientKeyToMaterial } from "../../../src/services/crypto/sendRecipientValidation";
import { assertNoSecretsLeaked } from "../../fixtures/identity";
import { ManagedWalletService } from "../../../src/services/stellar/managed-wallet";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import { CryptoError } from "../../../src/services/crypto/errors";
import {
  verifyEnvelopeSignature,
  ENVELOPE_SIGNATURE_DOMAIN,
  type EnvelopeSignature,
} from "../../../src/services/crypto/signature";
import { canonicalizePayload, type EnvelopePayload } from "../../../src/services/crypto/envelope";
import { toHex } from "../../../src/services/crypto/codec";
import { generateNonce } from "../../../src/services/crypto/nonce";
import { Buffer } from "node:buffer";

describe("BETA-085 misuse resistance (#1992)", () => {
  it("loads the regression corpus with expected attack classes", () => {
    expect(corpus.issue).toBe("1992");
    expect(corpus.attackClasses.length).toBeGreaterThanOrEqual(8);
    expect(corpus.boundedIterations).toBeGreaterThan(0);
  });

  describe("key exfiltration — persisted records never contain seeds", () => {
    async function provider(active = "v1") {
      const encoded: Record<string, string> = {
        v1: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      };
      return VersionedMasterKeyProvider.fromBase64(active, encoded);
    }

    it("sealed envelope JSON does not contain the Stellar secret", async () => {
      const seed = Keypair.random().secret();
      const address = Keypair.fromSecret(seed).publicKey();
      const keys = await provider();
      const envelope = await sealManagedWalletSeed(seed, address, keys);
      const serialized = JSON.stringify(envelope);
      expect(serialized).not.toContain(seed);
      assertNoSecretsLeaked(serialized);
    });

    it("store record JSON does not contain the seed after provision", async () => {
      const walletKey = Keypair.random();
      const store = new MemoryManagedWalletStore();
      const config = {
        network: { stellarNetwork: "testnet", networkPassphrase: "Test", rpcUrl: "http://x" },
        contract: {
          registryContractId: "C",
          postageContractId: "C",
          policiesContractId: "C",
          receiptsContractId: "C",
          domainTag: "t",
          protocolVersion: "1",
        },
        environment: "beta",
        secrets: {},
      } as unknown as BetaRuntimeConfig;
      const service = new ManagedWalletService(config, { store, keys: await provider() });
      const record = await service.provisionWallet(walletKey.publicKey(), walletKey.secret());
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain(walletKey.secret());
      assertNoSecretsLeaked(serialized);
    });
  });

  describe("tampered wrapped keys — fail closed without plaintext", () => {
    it("returns null when ciphertext or nonce is tampered", async () => {
      const recipient = await generateRecipientKeyPair();
      const contentKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
        "encrypt",
        "decrypt",
      ]);
      const wrapped = await wrapContentKey(contentKey, recipient.publicKey);

      const flip = (s: string) => (s[0] === "a" ? "b" + s.slice(1) : "a" + s.slice(1));
      const cases: WrappedKeyEntry[] = [
        { ...wrapped, wrappedKey: flip(wrapped.wrappedKey) },
        { ...wrapped, nonce: flip(wrapped.nonce) },
        { ...wrapped, blindedRecipientId: flip(wrapped.blindedRecipientId) },
      ];

      for (const tampered of cases) {
        const result = await unwrapContentKey(recipient.privateKey, [tampered]);
        expect(result).toBeNull();
        assertNoSecretsLeaked(JSON.stringify({ result, tampered: tampered.nonce.slice(0, 4) }));
      }
    });
  });

  describe("wrong master key version — typed failure, no seed leak", () => {
    it("rejects unwrap when envelope references an unavailable master version", async () => {
      const seed = Keypair.random().secret();
      const address = Keypair.fromSecret(seed).publicKey();
      const v1Bytes = crypto.getRandomValues(new Uint8Array(32));
      const provider = await VersionedMasterKeyProvider.fromBase64("v1", {
        v1: btoa(String.fromCharCode(...v1Bytes)),
      });
      const envelope = await sealManagedWalletSeed(seed, address, provider);
      const wrongVersion = { ...envelope, masterKeyVersion: "v-missing" };

      await expect(withManagedWalletSeed(wrongVersion, provider, () => "x")).rejects.toBeInstanceOf(
        ManagedWalletCryptoError,
      );
      const err = await withManagedWalletSeed(wrongVersion, provider, () => "x").catch((e) => e);
      expect(String(err)).not.toContain(seed);
      assertNoSecretsLeaked(String(err));
    });

    it("rewrap fails closed when old master key is unavailable", async () => {
      const seed = Keypair.random().secret();
      const address = Keypair.fromSecret(seed).publicKey();
      const provider = await VersionedMasterKeyProvider.fromBase64("v1", {
        v1: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      });
      const envelope = await sealManagedWalletSeed(seed, address, provider);
      const stripped = await VersionedMasterKeyProvider.fromBase64("v2", {
        v2: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      });

      await expect(rewrapManagedWallet(envelope, stripped, "v2")).rejects.toBeInstanceOf(
        ManagedWalletCryptoError,
      );
    });
  });

  describe("revoked recipients — send path rejects", () => {
    it("rejects revoked directory keys with stable code", async () => {
      const { publicKeySpkiBase64 } = await generateRecipientKeyPair();
      const recipient = Keypair.random().publicKey();
      await expect(
        recipientKeyToMaterial(
          {
            recipient,
            publicKey: Uint8Array.from(atob(publicKeySpkiBase64), (c) => c.charCodeAt(0)),
            keyId: "k-revoked",
            notBefore: "2020-01-01T00:00:00Z",
            notAfter: "2099-01-01T00:00:00Z",
            revoked: true,
            provenance: "trusted-directory",
          },
          recipient,
        ),
      ).rejects.toMatchObject({ code: "revoked" });
    });
  });

  describe("cryptographic failures — typed and non-oracular", () => {
    it("CryptoError messages are safe and do not echo secrets", () => {
      const err = new CryptoError("crypto_decrypt_error");
      expect(err.safe).toBe(true);
      expect(err.message).not.toMatch(/S[A-Z2-7]{55}/);
      assertNoSecretsLeaked(err.message);
    });

    it("ManagedWalletCryptoError uses a fixed public message", () => {
      const err = new ManagedWalletCryptoError();
      expect(err.code).toBe("managed_wallet_crypto_error");
      expect(err.message).toBe("Managed wallet cryptographic operation failed");
    });
  });

  describe("memory cleanup — failure paths do not echo seeds", () => {
    it("tampered envelope errors are generic and omit the seed", async () => {
      const seed = Keypair.random().secret();
      const address = Keypair.fromSecret(seed).publicKey();
      const provider = await VersionedMasterKeyProvider.fromBase64("v1", {
        v1: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
      });
      const envelope = await sealManagedWalletSeed(seed, address, provider);
      const tampered = { ...envelope, seedTag: "AAAAAAAAAAAAAAAAAAAAAA==" };

      const err = await withManagedWalletSeed(tampered, provider, () => "x").catch((e) => e);
      expect(err).toBeInstanceOf(ManagedWalletCryptoError);
      expect(String(err)).not.toContain(seed);
      assertNoSecretsLeaked(String(err));
    });
  });

  describe("signature substitution — envelope binding rejects wrong signer", () => {
    it("rejects a valid signature from a non-sender key", () => {
      const sender = Keypair.random();
      const impostor = Keypair.random();
      const payload: EnvelopePayload = {
        version: "v1",
        sender: sender.publicKey(),
        recipient: Keypair.random().publicKey(),
        timestamp: "2024-01-01T00:00:00.000Z",
        encryption_metadata: {
          algorithm: "AES-256-GCM",
          nonce: "0102030405060708090a0b0c",
          mac: "0102030405060708090a0b0c0d0e0f10",
        },
        content_commitment:
          "v1:sha256:hex:a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
        attachments: [],
      };
      const canonical = canonicalizePayload(payload);
      const sigBytes = impostor.sign(Buffer.from(ENVELOPE_SIGNATURE_DOMAIN + canonical));
      const signature: EnvelopeSignature = {
        scheme: "Ed25519",
        signerAddress: impostor.publicKey(),
        value: toHex(new Uint8Array(sigBytes)),
      };
      expect(verifyEnvelopeSignature(payload, signature, sender.publicKey())).toBe(false);
    });
  });

  describe("nonce reuse — production path generates distinct values", () => {
    it("never returns identical nonces across consecutive generations", () => {
      const a = generateNonce("AES-256-GCM");
      const b = generateNonce("AES-256-GCM");
      expect(a).not.toEqual(b);
    });
  });
});
