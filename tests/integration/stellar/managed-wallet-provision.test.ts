import { describe, expect, it } from "vitest";

import { provisionManagedStellarWallet } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { loadRuntimeConfig } from "../../../src/config";
import { FakeFundingAdapter } from "@/services/stellar/funding-adapter";

describe("managed wallet provisioning integration (BETA-015)", () => {
  it("persists encrypted material and funds through the fake adapter boundary", async () => {
    const repository = new MemoryApiRepository();
    const config = loadRuntimeConfig({ profile: "test" });
    const userId = "usr_integration_wallet";
    const now = "2026-01-01T00:00:00.000Z";
    const fundingAdapter = new FakeFundingAdapter();

    await repository.createUser({
      userId,
      address: `G${"C".repeat(55)}`,
      email: "integration@example.test",
      username: "integration",
      status: "pending_verification",
      createdAt: now,
      updatedAt: now,
      version: 1,
    });

    const result = await provisionManagedStellarWallet(repository, userId, config, {
      fundingAdapter,
      storageSecret: "integration-storage-secret",
    });

    const stored = await repository.getManagedWallet(userId);
    expect(stored).not.toBeNull();
    expect(stored?.fundingStatus).toBe("funded");
    expect(result.wallet.address).toBe(stored?.address);
    expect(JSON.stringify(result)).not.toMatch(/S[A-Z0-9]{55}/);
  });

  it.skipIf(process.env.STEALTH_LIVE_TESTNET !== "1")(
    "funds a wallet on live testnet when explicitly enabled",
    async () => {
      const { FriendbotFundingAdapter } = await import("@/services/stellar/funding-adapter");
      const repository = new MemoryApiRepository();
      const config = loadRuntimeConfig({ profile: "preview" });
      const userId = `usr_live_${Date.now()}`;
      const now = new Date().toISOString();

      await repository.createUser({
        userId,
        address: `G${"D".repeat(55)}`,
        email: `live-${Date.now()}@example.test`,
        username: `live${Date.now()}`.slice(0, 20),
        status: "pending_verification",
        createdAt: now,
        updatedAt: now,
        version: 1,
      });

      await provisionManagedStellarWallet(repository, userId, config, {
        fundingAdapter: new FriendbotFundingAdapter(),
        storageSecret: process.env.STEALTH_STORAGE_SECRET ?? "live-test-storage-secret",
      });
    },
  );
});
