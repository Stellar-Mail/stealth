import { describe, expect, it, vi, beforeEach } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  createChallenge,
  verifyChallenge,
  linkExternalWallet,
  unlinkExternalWallet,
  listExternalWallets,
  resolveActiveSigner,
  resolveTransactionSigner,
} from "../../../src/server/api/wallet-link-service";
import type { ExternalWallet } from "../../../src/server/api/domain";

const owner = `G${"A".repeat(55)}`;
const externalAddress = `G${"B".repeat(55)}`;
const otherOwner = `G${"C".repeat(55)}`;
const network = "Public Global Stellar Network ; September 2015";

describe("wallet link service", () => {
  let repository: MemoryApiRepository;

  beforeEach(() => {
    repository = new MemoryApiRepository();
  });

  describe("createChallenge", () => {
    it("creates a new challenge", async () => {
      const challenge = await createChallenge(repository, owner, externalAddress, network);

      expect(challenge.challenge).toMatch(/^[a-f0-9]{64}$/);
      expect(challenge.address).toBe(externalAddress);
      expect(challenge.network).toBe(network);
      expect(new Date(challenge.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("reuses existing valid challenge", async () => {
      const first = await createChallenge(repository, owner, externalAddress, network);
      const second = await createChallenge(repository, owner, externalAddress, network);

      expect(first.challenge).toBe(second.challenge);
    });

    it("creates separate challenges for different owners", async () => {
      const challenge1 = await createChallenge(repository, owner, externalAddress, network);
      const challenge2 = await createChallenge(repository, otherOwner, externalAddress, network);

      expect(challenge1.challenge).not.toBe(challenge2.challenge);
    });
  });

  describe("verifyChallenge", () => {
    it("returns no_challenge_found when no challenge exists", async () => {
      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "signature",
        externalAddress,
        network,
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("no_challenge_found");
    });

    it("returns challenge_expired for expired challenge", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 6 * 60 * 1000);

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "signature",
        externalAddress,
        network,
      );

      vi.useRealTimers();

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("challenge_expired");
    });

    it("returns signer_mismatch when signer differs from external address", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "signature",
        `G${"D".repeat(55)}`,
        network,
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("signer_mismatch");
    });

    it("returns invalid_signature for empty signature", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "",
        externalAddress,
        network,
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("invalid_signature");
    });

    it("returns network_mismatch when network differs from challenge", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "signature",
        externalAddress,
        "Test SDF Network ; September 2015",
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("network_mismatch");
    });

    it("verifies valid challenge successfully", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "valid_signature_hex",
        externalAddress,
        network,
      );

      expect(result.verified).toBe(true);
    });

    it("deletes challenge after successful verification", async () => {
      await createChallenge(repository, owner, externalAddress, network);

      await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "valid_signature_hex",
        externalAddress,
        network,
      );

      const result = await verifyChallenge(
        repository,
        owner,
        externalAddress,
        "another_signature",
        externalAddress,
        network,
      );

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("no_challenge_found");
    });
  });

  describe("linkExternalWallet", () => {
    const wallet: ExternalWallet = {
      address: externalAddress,
      capabilities: ["sign"],
      linkedAt: new Date().toISOString(),
      network,
    };

    it("links a new wallet", async () => {
      const result = await linkExternalWallet(repository, owner, wallet);

      expect(result.address).toBe(externalAddress);
      expect(result.capabilities).toEqual(["sign"]);
    });

    it("rejects duplicate wallet link", async () => {
      await linkExternalWallet(repository, owner, wallet);

      await expect(linkExternalWallet(repository, owner, wallet)).rejects.toThrow("already linked");
    });

    it("rejects wallet linked to another account", async () => {
      await linkExternalWallet(repository, otherOwner, wallet);

      await expect(linkExternalWallet(repository, owner, wallet)).rejects.toThrow(
        "linked to another account",
      );
    });
  });

  describe("unlinkExternalWallet", () => {
    it("unlinks an existing wallet and revokes linkage challenges", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await linkExternalWallet(repository, owner, wallet);
      await createChallenge(repository, owner, externalAddress, network);

      const activeSigner = await unlinkExternalWallet(repository, owner, externalAddress);

      const wallets = await listExternalWallets(repository, owner);
      expect(wallets).toHaveLength(0);
      expect(activeSigner.signerType).toBe("managed");
      expect(activeSigner.address).toBe(owner);
      expect(activeSigner.isFallback).toBe(true);

      const challenge = await repository.getWalletChallenge(owner, externalAddress);
      expect(challenge).toBeNull();
    });

    it("throws for non-existent wallet", async () => {
      await expect(unlinkExternalWallet(repository, owner, externalAddress)).rejects.toThrow(
        "not found",
      );
    });

    it("prevents unlinking when it would remove the primary/only access method", async () => {
      const wallet: ExternalWallet = {
        address: owner,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await linkExternalWallet(repository, owner, wallet);

      await expect(unlinkExternalWallet(repository, owner, owner)).rejects.toThrow(
        "Cannot remove the primary or only account access method",
      );
    });
  });

  describe("signer selection & fallback", () => {
    it("selects external wallet when available with sign capability", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await linkExternalWallet(repository, owner, wallet);

      const activeSigner = await resolveActiveSigner(repository, owner);
      expect(activeSigner.signerType).toBe("external");
      expect(activeSigner.address).toBe(externalAddress);
      expect(activeSigner.isFallback).toBe(false);
    });

    it("falls back to managed wallet when no external wallet exists", async () => {
      const activeSigner = await resolveActiveSigner(repository, owner);
      expect(activeSigner.signerType).toBe("managed");
      expect(activeSigner.address).toBe(owner);
      expect(activeSigner.isFallback).toBe(true);
    });

    it("resolves in-flight transaction signer with fallback to managed wallet if unlinked", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await linkExternalWallet(repository, owner, wallet);

      // In-flight transaction targeted externalAddress
      const signerBefore = await resolveTransactionSigner(repository, owner, externalAddress);
      expect(signerBefore.signerType).toBe("external");

      // Unlink external wallet
      await unlinkExternalWallet(repository, owner, externalAddress);

      // In-flight transaction now resolves to managed wallet fallback
      const signerAfter = await resolveTransactionSigner(repository, owner, externalAddress);
      expect(signerAfter.signerType).toBe("managed");
      expect(signerAfter.address).toBe(owner);
      expect(signerAfter.isFallback).toBe(true);
    });
  });

  describe("listExternalWallets", () => {
    it("returns empty array when no wallets linked", async () => {
      const wallets = await listExternalWallets(repository, owner);
      expect(wallets).toEqual([]);
    });

    it("returns linked wallets", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign", "read"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await linkExternalWallet(repository, owner, wallet);

      const wallets = await listExternalWallets(repository, owner);
      expect(wallets).toHaveLength(1);
      expect(wallets[0].address).toBe(externalAddress);
      expect(wallets[0].capabilities).toEqual(["sign", "read"]);
    });
  });
});
