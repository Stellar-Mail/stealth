import { describe, expect, it } from "vitest";

import { initializeMailboxPolicyDefaults } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  betaDefaultMailboxPolicy,
  getMailboxPolicy,
  getPolicyWriteIntent,
} from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;

describe("initializeMailboxPolicyDefaults (BETA-023 / Issue #1930)", () => {
  it("provisions the privacy-safe beta default on first run", async () => {
    const repository = new MemoryApiRepository();

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result).toMatchObject({
      provisioned: true,
      source: "default",
      offchainVersion: 1,
      scheduled: true,
      policy: betaDefaultMailboxPolicy,
    });

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy: {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0",
      },
      source: "configured",
    });
  });

  it("schedules a matching testnet contract write at version 1", async () => {
    const repository = new MemoryApiRepository();

    await initializeMailboxPolicyDefaults(repository, owner);

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      status: "pending",
      offchainVersion: 1,
      policy: betaDefaultMailboxPolicy,
    });
  });

  it("is idempotent: a retry never bumps the version or re-schedules", async () => {
    const repository = new MemoryApiRepository();

    await initializeMailboxPolicyDefaults(repository, owner);
    const second = await initializeMailboxPolicyDefaults(repository, owner);
    const third = await initializeMailboxPolicyDefaults(repository, owner);

    expect(second).toMatchObject({ provisioned: false, scheduled: false });
    expect(third).toMatchObject({ provisioned: false, scheduled: false });

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.offchainVersion).toBe(1);
  });

  it("never overwrites a user-customized policy", async () => {
    const repository = new MemoryApiRepository();

    const { setMailboxPolicy } = await import("../../../src/server/api/policy-service");
    await setMailboxPolicy(repository, owner, {
      allowUnknown: false,
      requireVerified: true,
      minimumPostage: "250",
    });

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result).toMatchObject({
      provisioned: false,
      source: "configured",
      scheduled: false,
      offchainVersion: 1,
    });

    await expect(getMailboxPolicy(repository, owner)).resolves.toMatchObject({
      policy: {
        allowUnknown: false,
        requireVerified: true,
        minimumPostage: "250",
      },
    });
  });

  it("reports the beta default as the scheduled policy", async () => {
    const repository = new MemoryApiRepository();

    const result = await initializeMailboxPolicyDefaults(repository, owner);

    expect(result.policy).toEqual(betaDefaultMailboxPolicy);
  });
});
