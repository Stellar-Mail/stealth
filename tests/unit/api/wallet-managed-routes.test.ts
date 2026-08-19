import { beforeEach, describe, expect, it } from "vitest";

import { MemoryApiRepository } from "@/server/api/memory-repository";
import { Route as ManagedWalletRoute } from "@/routes/api/v1/wallet/managed";
import { Route as WalletAddressRoute } from "@/routes/api/v1/wallet/link/$address";
import { ACTOR_HEADER } from "@/server/api/actor";
import { getApiContext } from "@/server/api/context";
import type { ExternalWallet } from "@/server/api/domain";

const owner = `G${"A".repeat(55)}`;
const externalAddress = `G${"B".repeat(55)}`;
const network = "Test SDF Network ; September 2015";

const managedHandler = (ManagedWalletRoute.options as any).server?.handlers?.GET;
const patchHandler = (WalletAddressRoute.options as any).server?.handlers?.PATCH;
const deleteHandler = (WalletAddressRoute.options as any).server?.handlers?.DELETE;

function request(path: string, method: string, actor?: string, body?: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (actor !== undefined) headers[ACTOR_HEADER] = actor;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://stealth.test${path}`, init);
}

describe("Managed and External Wallet API Routes (Issue #1977 BETA-070)", () => {
  let repository: MemoryApiRepository;

  beforeEach(async () => {
    const ctx = await getApiContext();
    repository = ctx.repository as MemoryApiRepository;
    repository.reset?.();
  });

  describe("GET /api/v1/wallet/managed", () => {
    it("returns public managed wallet status without exposing custody secrets", async () => {
      const req = request("/api/v1/wallet/managed", "GET", owner);
      const res = await managedHandler({ request: req });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.address).toBe(owner);
      expect(json.data.status).toBeDefined();
      expect(json.data.network).toBeDefined();
      expect(json.data.capabilities).toEqual(["sign", "send", "read"]);
      expect(json.data.isDefaultSigner).toBe(true);
      expect(json.data.activeSigner.signerType).toBe("managed");

      // Critical security check: ensure no private key or envelope secrets are exposed
      const stringified = JSON.stringify(json);
      expect(stringified).not.toContain("seed");
      expect(stringified).not.toContain("secret");
      expect(stringified).not.toContain("encryptedEnvelope");
      expect(stringified).not.toContain("masterKey");
    });

    it("rejects unauthenticated requests", async () => {
      const req = request("/api/v1/wallet/managed", "GET");
      const res = await managedHandler({ request: req });
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/v1/wallet/link/:address (Update Capabilities)", () => {
    it("updates permitted capabilities for an existing linked wallet", async () => {
      // First link a wallet
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["read"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await repository.setExternalWallet(owner, wallet);

      const req = request(`/api/v1/wallet/link/${externalAddress}`, "PATCH", owner, {
        capabilities: ["sign", "send"],
      });
      const res = await patchHandler({
        request: req,
        params: { address: externalAddress },
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.wallet.capabilities).toEqual(["sign", "send"]);
      expect(json.data.activeSigner.signerType).toBe("external");
      expect(json.data.activeSigner.address).toBe(externalAddress);
    });

    it("fails with 404 if external wallet is not found", async () => {
      const req = request(`/api/v1/wallet/link/${externalAddress}`, "PATCH", owner, {
        capabilities: ["sign"],
      });
      const res = await patchHandler({
        request: req,
        params: { address: externalAddress },
      });
      expect(res.status).toBe(404);
    });

    it("fails with 400 if empty capabilities provided", async () => {
      const req = request(`/api/v1/wallet/link/${externalAddress}`, "PATCH", owner, {
        capabilities: [],
      });
      const res = await patchHandler({
        request: req,
        params: { address: externalAddress },
      });
      expect(res.status).toBe(422); // Zod validation failure
    });
  });

  describe("DELETE /api/v1/wallet/link/:address (Unlink & Fallback)", () => {
    it("unlinks external wallet and falls back to managed wallet as active signer", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await repository.setExternalWallet(owner, wallet);

      const req = request(`/api/v1/wallet/link/${externalAddress}?confirm=true`, "DELETE", owner);
      const res = await deleteHandler({
        request: req,
        params: { address: externalAddress },
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.unlinked).toBe(true);
      expect(json.data.activeSigner.signerType).toBe("managed");
      expect(json.data.activeSigner.address).toBe(owner);
      expect(json.data.activeSigner.isFallback).toBe(true);
    });

    it("rejects unlinking if explicit confirmation is denied", async () => {
      const wallet: ExternalWallet = {
        address: externalAddress,
        capabilities: ["sign"],
        linkedAt: new Date().toISOString(),
        network,
      };
      await repository.setExternalWallet(owner, wallet);

      const req = request(`/api/v1/wallet/link/${externalAddress}?confirm=false`, "DELETE", owner);
      const res = await deleteHandler({
        request: req,
        params: { address: externalAddress },
      });
      expect(res.status).toBe(400);
    });
  });
});
