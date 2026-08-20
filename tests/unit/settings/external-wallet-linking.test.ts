import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type {
  ExternalWallet,
  WalletCapability,
  ManagedWalletStatus,
} from "../../../src/server/api/domain";
import {
  getManagedWalletStatus,
  requestChallenge,
  verifyAndLink,
  listLinkedWallets,
  updateWalletCapabilities,
  unlinkWallet,
  WalletLinkError,
  WrongNetworkError,
  WalletNotInstalledError,
  WalletRejectedError,
} from "../../../src/services/stellar/wallet-link";

const owner = `G${"A".repeat(55)}`;
const externalAddress = `G${"B".repeat(55)}`;
const network = "Test SDF Network ; September 2015";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("wallet-link client service (Issue #1977 BETA-070)", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("getManagedWalletStatus", () => {
    it("returns managed wallet status and balance on success", async () => {
      const mockStatus: ManagedWalletStatus = {
        address: owner,
        status: "active",
        network,
        balance: { available: "10000000", balanceXlm: "1.00" },
        capabilities: ["sign", "send", "read"],
        isDefaultSigner: true,
        activeSigner: {
          signerType: "managed",
          address: owner,
          capabilities: ["sign", "send", "read"],
          isFallback: true,
        },
      };

      globalThis.fetch = mockFetchOnce(200, { data: mockStatus }) as typeof fetch;

      const result = await getManagedWalletStatus();
      expect(result.address).toBe(owner);
      expect(result.balance.balanceXlm).toBe("1.00");
      expect(result.isDefaultSigner).toBe(true);
      expect(result.activeSigner.signerType).toBe("managed");
    });

    it("throws WalletLinkError on failure", async () => {
      globalThis.fetch = mockFetchOnce(500, {
        error: { message: "Internal server error" },
      }) as typeof fetch;

      await expect(getManagedWalletStatus()).rejects.toThrow(WalletLinkError);
    });
  });

  describe("requestChallenge", () => {
    it("returns challenge data on success", async () => {
      globalThis.fetch = mockFetchOnce(200, {
        data: {
          challenge: "a".repeat(64),
          expiresAt: "2026-01-01T00:00:00.000Z",
        },
      }) as typeof fetch;

      const result = await requestChallenge(externalAddress, network);
      expect(result.challenge).toBe("a".repeat(64));
      expect(result.expiresAt).toBe("2026-01-01T00:00:00.000Z");
    });

    it("throws WalletLinkError on failure", async () => {
      globalThis.fetch = mockFetchOnce(401, {
        error: { message: "Unauthorized" },
      }) as typeof fetch;

      await expect(requestChallenge(externalAddress, network)).rejects.toThrow(WalletLinkError);
    });
  });

  describe("verifyAndLink", () => {
    it("returns linked wallet on success", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: "2026-01-01T00:00:00.000Z",
        network,
      };
      globalThis.fetch = mockFetchOnce(200, { data: wallet }) as typeof fetch;

      const result = await verifyAndLink(externalAddress, "signature", ["sign"], network);
      expect(result.address).toBe(externalAddress);
      expect(result.capabilities).toEqual(["sign"]);
    });

    it("throws WalletLinkError on server error", async () => {
      globalThis.fetch = mockFetchOnce(400, {
        error: { message: "Challenge verification failed" },
      }) as typeof fetch;

      await expect(verifyAndLink(externalAddress, "bad", ["sign"], network)).rejects.toThrow(
        "Challenge verification failed",
      );
    });
  });

  describe("updateWalletCapabilities", () => {
    it("updates capabilities for linked wallet", async () => {
      const updated: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign", "send"],
        linkedAt: "2026-01-01T00:00:00.000Z",
        network,
      };
      const activeSigner = {
        signerType: "external" as const,
        address: externalAddress,
        capabilities: ["sign", "send"] as WalletCapability[],
        isFallback: false,
      };

      globalThis.fetch = mockFetchOnce(200, {
        data: { wallet: updated, activeSigner },
      }) as typeof fetch;

      const res = await updateWalletCapabilities(externalAddress, ["sign", "send"]);
      expect(res.wallet.capabilities).toEqual(["sign", "send"]);
      expect(res.activeSigner.signerType).toBe("external");
    });

    it("throws WalletLinkError on update failure", async () => {
      globalThis.fetch = mockFetchOnce(404, {
        error: { message: "External wallet not found" },
      }) as typeof fetch;

      await expect(updateWalletCapabilities(externalAddress, ["sign"])).rejects.toThrow(
        WalletLinkError,
      );
    });
  });

  describe("listLinkedWallets", () => {
    it("returns wallets from envelope", async () => {
      const wallets: ExternalWallet[] = [
        {
          address: externalAddress,
          capabilities: ["sign", "read"],
          linkedAt: "2026-01-01T00:00:00.000Z",
          network,
        },
      ];
      globalThis.fetch = mockFetchOnce(200, {
        data: { wallets },
      }) as typeof fetch;

      const result = await listLinkedWallets();
      expect(result).toHaveLength(1);
      expect(result[0].address).toBe(externalAddress);
    });

    it("throws on failed response", async () => {
      globalThis.fetch = mockFetchOnce(500, {
        error: { message: "Internal error" },
      }) as typeof fetch;

      await expect(listLinkedWallets()).rejects.toThrow(WalletLinkError);
    });
  });

  describe("unlinkWallet", () => {
    it("succeeds on 2xx", async () => {
      globalThis.fetch = mockFetchOnce(200, {
        data: { unlinked: true },
      }) as typeof fetch;

      await expect(unlinkWallet(externalAddress)).resolves.toEqual({
        unlinked: true,
      });
    });

    it("passes explicit confirmation parameter when provided", async () => {
      const mockFetch = mockFetchOnce(200, {
        data: {
          unlinked: true,
          activeSigner: {
            signerType: "managed",
            address: owner,
            capabilities: ["sign"],
            isFallback: true,
          },
        },
      });
      globalThis.fetch = mockFetch as typeof fetch;

      await unlinkWallet(externalAddress, { confirm: true });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("confirm=true"),
        expect.objectContaining({
          headers: expect.objectContaining({ "x-stealth-confirm": "true" }),
        }),
      );
    });

    it("throws on failure", async () => {
      globalThis.fetch = mockFetchOnce(404, {
        error: { message: "External wallet not found" },
      }) as typeof fetch;

      await expect(unlinkWallet(externalAddress)).rejects.toThrow(WalletLinkError);
    });
  });

  describe("Error taxonomy", () => {
    it("constructs error classes with proper names and status codes", () => {
      const wrongNet = new WrongNetworkError();
      expect(wrongNet.name).toBe("WrongNetworkError");
      expect(wrongNet.code).toBe("wrong_network");

      const notInstalled = new WalletNotInstalledError();
      expect(notInstalled.name).toBe("WalletNotInstalledError");
      expect(notInstalled.code).toBe("wallet_not_installed");

      const rejected = new WalletRejectedError();
      expect(rejected.name).toBe("WalletRejectedError");
      expect(rejected.code).toBe("wallet_rejected");
    });
  });
});
