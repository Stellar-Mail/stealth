import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Route as WalletStatusRoute } from "../../../src/routes/api/v1/wallet/status";
import { ACTOR_HEADER } from "../../../src/server/api/actor";
import { getApiContext } from "../../../src/server/api/context";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type {
  Credential,
  ManagedWalletRecord,
  Profile,
  User,
} from "../../../src/server/api/domain";
import { resetDefaultWalletStatusCache } from "../../../src/services/stellar/wallet-status";

const OWNER = `G${"A".repeat(55)}`;
const WALLET = `G${"W".repeat(55)}`;
const STRANGER = `G${"C".repeat(55)}`;

const getHandler = (WalletStatusRoute.options as any).server?.handlers?.GET;

function statusRequest(actor?: string, address?: string) {
  const url = new URL("https://stealth.test/api/v1/wallet/status");
  if (address) url.searchParams.set("address", address);
  const headers: Record<string, string> = {};
  if (actor) headers[ACTOR_HEADER] = actor;
  return new Request(url, { method: "GET", headers });
}

async function parseJson(response: Response) {
  return response.clone().json() as Promise<{
    error?: { code: string; message: string };
    data?: Record<string, unknown>;
  }>;
}

async function seedOwner(repo: MemoryApiRepository) {
  const userId = "usr_wallet_status_route";
  const now = "2026-01-01T00:00:00.000Z";
  const user: User = {
    userId,
    address: OWNER,
    email: "owner@example.test",
    username: "owner_status",
    status: "active",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  await repo.createUser(
    user,
    {
      credentialId: "cred_owner_status",
      userId,
      authMethod: "password_hash",
      secretHash: "hash:salt",
      walletKeyRef: `wallet:managed:${userId}`,
      createdAt: now,
      updatedAt: now,
    } satisfies Credential,
    {
      userId,
      username: user.username,
      displayName: "Owner",
      locale: "en-US",
      timezone: "UTC",
      addressDisplay: "full" as const,
      createdAt: now,
      updatedAt: now,
    } satisfies Profile,
  );
  await repo.setManagedWallet({
    userId,
    address: WALLET,
    network: "testnet",
    fundingStatus: "funded",
    encryptedSecret: {
      ciphertext: "cipher-not-for-clients",
      nonce: "nonce-not-for-clients",
      tag: "tag-not-for-clients",
      keyVersion: 1,
    },
    fundedAt: now,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  } satisfies ManagedWalletRecord);
}

describe("GET /api/v1/wallet/status (BETA-019)", () => {
  let repo: MemoryApiRepository;

  beforeEach(async () => {
    repo = (await getApiContext()).repository as MemoryApiRepository;
    repo.reset();
    resetDefaultWalletStatusCache();
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          balances: [{ asset_type: "native", balance: "4.2500000" }],
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects requests without an actor header", async () => {
    const response = await getHandler({ request: statusRequest() });
    expect(response.status).toBe(401);
    expect((await parseJson(response)).error?.code).toBe("unauthorized");
  });

  it("returns owner-only public metadata without custody fields", async () => {
    await seedOwner(repo);
    const response = await getHandler({ request: statusRequest(OWNER) });
    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data?.address).toBe(WALLET);
    expect(body.data?.balanceXlm).toBe("4.2500000");
    expect(body.data?.activation).toBe("active");
    expect(body.data?.network).toBe("testnet");
    expect(body.data?.freshness).toBe("fresh");
    expect(body.data).not.toHaveProperty("encryptedSecret");
    expect(body.data).not.toHaveProperty("secretKey");
    expect(JSON.stringify(body.data)).not.toMatch(/cipher-not-for-clients/);
  });

  it("forbids a stranger querying another wallet address", async () => {
    await seedOwner(repo);
    const now = "2026-01-01T00:00:00.000Z";
    await repo.createUser({
      userId: "usr_stranger_status",
      address: STRANGER,
      email: "stranger@example.test",
      username: "stranger_status",
      status: "active",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });
    await repo.setManagedWallet({
      userId: "usr_stranger_status",
      address: `G${"S".repeat(55)}`,
      network: "testnet",
      fundingStatus: "funded",
      encryptedSecret: {
        ciphertext: "cipher-not-for-clients",
        nonce: "nonce-not-for-clients",
        tag: "tag-not-for-clients",
        keyVersion: 1,
      },
      fundedAt: now,
      createdAt: now,
      updatedAt: now,
      lastError: null,
    });

    const response = await getHandler({ request: statusRequest(STRANGER, WALLET) });
    expect(response.status).toBe(403);
    expect((await parseJson(response)).error?.code).toBe("forbidden");
  });
});
