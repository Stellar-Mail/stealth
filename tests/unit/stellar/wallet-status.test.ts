import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ApiError } from "../../../src/server/api/errors";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import type {
  Credential,
  ManagedWalletRecord,
  Profile,
  User,
} from "../../../src/server/api/domain";
import {
  MemoryWalletStatusCache,
  WalletRpcUnavailableError,
  activationFromWallet,
  assertPublicWalletStatus,
  readPublicWalletStatus,
  type HorizonAccountReader,
  type PublicWalletStatus,
} from "../../../src/services/stellar/wallet-status";

const OWNER = `G${"A".repeat(55)}`;
const WALLET = `G${"W".repeat(55)}`;
const STRANGER = `G${"C".repeat(55)}`;

const testConfig = {
  profile: "test",
  network: {
    stellarNetwork: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  },
} as BetaRuntimeConfig;

function sampleUser(userId: string, address: string): User {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    userId,
    address,
    email: `${userId}@example.test`,
    username: userId.replace(/[^a-z0-9_]/gi, "_").slice(0, 20),
    status: "pending_verification",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

function encryptedSecret() {
  return {
    ciphertext: "cipher-not-for-clients",
    nonce: "nonce-not-for-clients",
    tag: "tag-not-for-clients",
    keyVersion: 1,
  };
}

function walletRecord(
  userId: string,
  fundingStatus: ManagedWalletRecord["fundingStatus"],
): ManagedWalletRecord {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    userId,
    address: WALLET,
    network: "testnet",
    fundingStatus,
    encryptedSecret: encryptedSecret(),
    fundedAt: fundingStatus === "funded" ? now : null,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
}

async function seedOwner(
  repository: MemoryApiRepository,
  fundingStatus: ManagedWalletRecord["fundingStatus"] = "funded",
) {
  const userId = "usr_wallet_status";
  const user = sampleUser(userId, OWNER);
  await repository.createUser(
    user,
    {
      credentialId: "cred_wallet_status",
      userId,
      authMethod: "password_hash",
      secretHash: "hash:salt",
      walletKeyRef: `wallet:managed:${userId}`,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies Credential,
    {
      userId,
      username: user.username,
      displayName: "Owner",
      locale: "en-US",
      timezone: "UTC",
      addressDisplay: "full" as const,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies Profile,
  );
  await repository.setManagedWallet(walletRecord(userId, fundingStatus));
  return userId;
}

function fakeHorizon(
  result: Awaited<ReturnType<HorizonAccountReader["readNativeBalance"]>> | Error,
) {
  return {
    async readNativeBalance() {
      if (result instanceof Error) throw result;
      return result;
    },
  } satisfies HorizonAccountReader;
}

function secretKeysOf(status: PublicWalletStatus): string[] {
  return Object.keys(status).filter((key) =>
    /secret|seed|cipher|private|encrypted|nonce|tag|mnemonic/i.test(key),
  );
}

describe("readPublicWalletStatus (BETA-019)", () => {
  it("returns an active funded wallet without custody fields", async () => {
    const repository = new MemoryApiRepository();
    await seedOwner(repository, "funded");
    const cache = new MemoryWalletStatusCache();

    const status = await readPublicWalletStatus({
      repository,
      actorAddress: OWNER,
      config: testConfig,
      horizon: fakeHorizon({ nativeBalanceXlm: "12.5000000" }),
      cache,
      now: new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(status.address).toBe(WALLET);
    expect(status.network).toBe("testnet");
    expect(status.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(status.balanceXlm).toBe("12.5000000");
    expect(status.activation).toBe("active");
    expect(status.freshness).toBe("fresh");
    expect(status.stale).toBe(false);
    expect(status.lastSyncedAt).toBe("2026-08-18T12:00:00.000Z");
    expect(secretKeysOf(status)).toEqual([]);
    expect(JSON.stringify(status)).not.toMatch(/cipher|nonce|tag|encryptedSecret|S[A-Z0-9]{55}/);
    expect(assertPublicWalletStatus(status)).toEqual(status);
  });

  it("reports activation pending when the managed wallet is not funded", async () => {
    const repository = new MemoryApiRepository();
    await seedOwner(repository, "pending");

    const status = await readPublicWalletStatus({
      repository,
      actorAddress: OWNER,
      config: testConfig,
      horizon: fakeHorizon("not_found"),
      cache: new MemoryWalletStatusCache(),
    });

    expect(status.activation).toBe("pending");
    expect(status.balanceXlm).toBeNull();
    expect(status.freshness).toBe("fresh");
    expect(secretKeysOf(status)).toEqual([]);
  });

  it("forbids a stranger from reading another user's wallet metadata", async () => {
    const repository = new MemoryApiRepository();
    await seedOwner(repository, "funded");
    const stranger = sampleUser("usr_stranger", STRANGER);
    await repository.createUser(stranger);
    await repository.setManagedWallet({
      ...walletRecord("usr_stranger", "funded"),
      address: `G${"S".repeat(55)}`,
      userId: "usr_stranger",
    });

    await expect(
      readPublicWalletStatus({
        repository,
        actorAddress: STRANGER,
        requestedAddress: WALLET,
        config: testConfig,
        horizon: fakeHorizon({ nativeBalanceXlm: "1" }),
        cache: new MemoryWalletStatusCache(),
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return error instanceof ApiError && error.status === 403 && error.code === "forbidden";
    });
  });

  it("serves a stale cache snapshot when Horizon/RPC is unavailable", async () => {
    const repository = new MemoryApiRepository();
    await seedOwner(repository, "funded");
    const cache = new MemoryWalletStatusCache();
    await cache.set(WALLET, {
      nativeBalanceXlm: "9.0000000",
      fetchedAt: "2026-08-18T11:59:00.000Z",
      available: true,
    });

    const status = await readPublicWalletStatus({
      repository,
      actorAddress: OWNER,
      config: testConfig,
      horizon: fakeHorizon(new WalletRpcUnavailableError()),
      cache,
      ttlMs: 1,
      now: new Date("2026-08-18T12:00:00.000Z"),
    });

    expect(status.freshness).toBe("stale");
    expect(status.stale).toBe(true);
    expect(status.balanceXlm).toBe("9.0000000");
    expect(status.lastSyncedAt).toBe("2026-08-18T11:59:00.000Z");
    expect(status.activation).toBe("active");
  });

  it("marks status unavailable when RPC is down and no usable cache exists", async () => {
    const repository = new MemoryApiRepository();
    await seedOwner(repository, "funded");

    const status = await readPublicWalletStatus({
      repository,
      actorAddress: OWNER,
      config: testConfig,
      horizon: fakeHorizon(new WalletRpcUnavailableError()),
      cache: new MemoryWalletStatusCache(),
    });

    expect(status.freshness).toBe("unavailable");
    expect(status.stale).toBe(true);
    expect(status.balanceXlm).toBeNull();
    expect(status.lastSyncedAt).toBeNull();
  });

  it("rejects public status objects that carry custody field names", () => {
    expect(() =>
      assertPublicWalletStatus({
        address: WALLET,
        network: "testnet",
        networkPassphrase: "x",
        balanceXlm: "0",
        activation: "active",
        lastSyncedAt: null,
        stale: false,
        freshness: "fresh",
        encryptedSecret: "nope",
      } as PublicWalletStatus),
    ).toThrow(/custody fields/);
  });
});

describe("activationFromWallet", () => {
  it("maps funded, failed, and pending records", () => {
    expect(activationFromWallet(walletRecord("u", "funded"), null)).toBe("active");
    expect(activationFromWallet(walletRecord("u", "failed"), null)).toBe("failed");
    expect(activationFromWallet(walletRecord("u", "pending"), null)).toBe("pending");
  });
});
