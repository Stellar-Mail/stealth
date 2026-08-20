import { describe, expect, it } from "vitest";

import { provisionManagedStellarWallet } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { ApiError } from "../../../src/server/api/errors";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import { FakeFundingAdapter } from "@/services/stellar/funding-adapter";
import { PROVISIONING_LIMITS } from "../../../src/server/api/rate-limit";
import { fundingOperationIdForUser, listPublicFundingQueue } from "@/services/stellar/funding";
import type { Credential, Profile, User } from "../../../src/server/api/domain";

const storageSecret = "test-storage-secret-for-managed-wallets";
const testConfig = {
  profile: "test",
  network: {
    stellarNetwork: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
  },
} as BetaRuntimeConfig;

function sampleUser(userId: string, pad = "D"): User {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    userId,
    address: `G${pad.repeat(55)}`,
    email: `${userId}@example.test`,
    username: userId.replace(/[^a-z0-9_]/gi, "_").slice(0, 20),
    status: "pending_verification",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

async function seedAccount(repository: MemoryApiRepository, userId: string, pad = "D") {
  const user = sampleUser(userId, pad);
  await repository.createUser(
    user,
    {
      credentialId: `cred_${userId}`,
      userId,
      authMethod: "password_hash",
      secretHash: "hash:salt",
      walletKeyRef: `pending_${userId}`,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies Credential,
    {
      userId,
      username: user.username,
      displayName: "Bob",
      locale: "en-US",
      timezone: "UTC",
      addressDisplay: "full" as const,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    } satisfies Profile,
  );
}

describe("provisionManagedStellarWallet abuse-safe funding (BETA-018)", () => {
  it("rejects repeated provisioning from the same account", async () => {
    const repository = new MemoryApiRepository();
    const userId = "usr_limit_account";
    await seedAccount(repository, userId);
    const adapter = new FakeFundingAdapter();
    adapter.failAll("timeout");

    for (let i = 0; i < PROVISIONING_LIMITS.account.max; i += 1) {
      await provisionManagedStellarWallet(repository, userId, testConfig, {
        fundingAdapter: adapter,
        storageSecret,
        accountId: userId,
        origin: "203.0.113.10",
      });
    }

    await expect(
      provisionManagedStellarWallet(repository, userId, testConfig, {
        fundingAdapter: adapter,
        storageSecret,
        accountId: userId,
        origin: "203.0.113.10",
      }),
    ).rejects.toMatchObject({ code: "too_many_requests" } satisfies Partial<ApiError>);
  });

  it("rejects repeated provisioning from the same origin across accounts", async () => {
    const repository = new MemoryApiRepository();
    const adapter = new FakeFundingAdapter();
    const origin = "198.51.100.9";

    for (let i = 0; i < PROVISIONING_LIMITS.origin.max; i += 1) {
      const userId = `usr_origin_${i}`;
      const pad = "234567ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(i) || "A";
      await seedAccount(repository, userId, pad);
      await provisionManagedStellarWallet(repository, userId, testConfig, {
        fundingAdapter: adapter,
        storageSecret,
        accountId: userId,
        origin,
      });
    }

    const extra = "usr_origin_extra";
    await seedAccount(repository, extra, "Q");
    await expect(
      provisionManagedStellarWallet(repository, extra, testConfig, {
        fundingAdapter: adapter,
        storageSecret,
        accountId: extra,
        origin,
      }),
    ).rejects.toMatchObject({ code: "too_many_requests" });
  });

  it("keeps a pending funding state and surfaces it on the admin queue", async () => {
    const repository = new MemoryApiRepository();
    const userId = "usr_pending_queue";
    await seedAccount(repository, userId);
    const adapter = new FakeFundingAdapter();
    adapter.failAll("timeout");

    const result = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter: adapter,
      storageSecret,
    });

    expect(result.wallet.fundingStatus).toBe("pending");
    expect(result.wallet).not.toHaveProperty("encryptedSecret");

    const queue = await listPublicFundingQueue(repository);
    expect(queue[0]?.operationId).toBe(fundingOperationIdForUser(userId));
    expect(queue[0]?.status).toBe("retrying");
    expect(JSON.stringify(queue[0])).not.toMatch(/encryptedSecret|secretKey/i);
  });

  it("does not create a second funded account on replay", async () => {
    const repository = new MemoryApiRepository();
    const userId = "usr_no_repeat";
    await seedAccount(repository, userId);
    const adapter = new FakeFundingAdapter();

    const first = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter: adapter,
      storageSecret,
    });
    const second = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter: adapter,
      storageSecret,
    });

    expect(first.wallet.fundingStatus).toBe("funded");
    expect(second.wallet.address).toBe(first.wallet.address);
    expect(adapter.callCounts.get(first.wallet.address)).toBe(1);
  });
});
