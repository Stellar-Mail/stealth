import { describe, expect, it } from "vitest";

import { provisionManagedStellarWallet } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import type { BetaRuntimeConfig } from "../../../src/config/schema";
import { FakeFundingAdapter } from "@/services/stellar/funding-adapter";
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

function sampleUser(userId: string, address: string): User {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    userId,
    address,
    email: "alice@example.test",
    username: "alice",
    status: "pending_verification",
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
}

describe("provisionManagedStellarWallet (BETA-015 / Issue #1922)", () => {
  it("creates, funds, and persists a managed wallet without exposing secrets", async () => {
    const repository = new MemoryApiRepository();
    const userId = "usr_test_wallet";
    const fundingAdapter = new FakeFundingAdapter();
    const user = sampleUser(userId, `G${"A".repeat(55)}`);

    await repository.createUser(
      user,
      {
        credentialId: "cred_test",
        userId,
        authMethod: "password_hash",
        secretHash: "hash:salt",
        walletKeyRef: `pending_${userId}`,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } satisfies Credential,
      {
        userId,
        username: "alice",
        displayName: "Alice",
        locale: "en-US",
        timezone: "UTC",
        addressDisplay: "full" as const,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } satisfies Profile,
    );

    const first = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter,
      storageSecret,
    });

    expect(first.wallet.provisioned).toBe(true);
    expect(first.wallet.network).toBe("testnet");
    expect(first.wallet.fundingStatus).toBe("funded");
    expect(first.wallet.address).toMatch(/^G[A-Z2-7]{55}$/);
    expect(first.wallet).not.toHaveProperty("secretKey");
    expect(first.wallet).not.toHaveProperty("encryptedSecret");
    expect(fundingAdapter.fundedAccounts.has(first.wallet.address)).toBe(true);

    const stored = await repository.getManagedWallet(userId);
    expect(stored?.address).toBe(first.wallet.address);
    expect(stored?.encryptedSecret.ciphertext.length).toBeGreaterThan(0);

    const credential = await repository.getCredential(userId);
    expect(credential?.walletKeyRef).toBe(`wallet:managed:${userId}`);
  });

  it("is idempotent and does not create duplicate wallets", async () => {
    const repository = new MemoryApiRepository();
    const userId = "usr_idempotent_wallet";
    const fundingAdapter = new FakeFundingAdapter();
    const user = sampleUser(userId, `G${"B".repeat(55)}`);

    await repository.createUser(user, {
      credentialId: "cred_idem",
      userId,
      authMethod: "password_hash",
      secretHash: "hash:salt",
      walletKeyRef: `pending_${userId}`,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });

    const first = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter,
      storageSecret,
    });
    const second = await provisionManagedStellarWallet(repository, userId, testConfig, {
      fundingAdapter,
      storageSecret,
    });

    expect(second.wallet.provisioned).toBe(false);
    expect(second.wallet.address).toBe(first.wallet.address);
    expect(fundingAdapter.fundedAccounts.size).toBe(1);
  });
});
