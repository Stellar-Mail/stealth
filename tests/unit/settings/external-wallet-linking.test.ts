import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { ExternalWallet, WalletCapability } from "../../../src/server/api/domain";
import {
  requestChallenge,
  verifyAndLink,
  listLinkedWallets,
  unlinkWallet,
  WalletLinkError,
} from "../../../src/services/stellar/wallet-link";

const externalAddress = `G${"B".repeat(55)}`;
const network = "Public Global Stellar Network ; September 2015";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe("wallet-link client service", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("requestChallenge", () => {
    it("returns challenge data on success", async () => {
      globalThis.fetch = mockFetchOnce(200, {
        data: { challenge: "a".repeat(64), expiresAt: "2026-01-01T00:00:00.000Z" },
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
      globalThis.fetch = mockFetchOnce(200, { data: { wallets } }) as typeof fetch;

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
      globalThis.fetch = mockFetchOnce(200, { data: { unlinked: true } }) as typeof fetch;

      await expect(unlinkWallet(externalAddress)).resolves.toEqual({ unlinked: true });
    });

    it("passes explicit confirmation parameter when provided", async () => {
      const mockFetch = mockFetchOnce(200, { data: { unlinked: true } });
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
});

describe("external wallet linking pure logic", () => {
  function toggleCapability(
    current: WalletCapability[],
    cap: WalletCapability,
  ): WalletCapability[] {
    return current.includes(cap) ? current.filter((c) => c !== cap) : [...current, cap];
  }

  it("adds a capability when absent", () => {
    expect(toggleCapability(["sign"], "send")).toEqual(["sign", "send"]);
  });

  it("removes a capability when present", () => {
    expect(toggleCapability(["sign", "send"], "send")).toEqual(["sign"]);
  });

  it("does not duplicate capabilities", () => {
    const result = toggleCapability(toggleCapability(["sign"], "send"), "send");
    expect(result).toEqual(["sign"]);
  });
});
