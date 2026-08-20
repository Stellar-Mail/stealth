import { describe, expect, it } from "vitest";

import { initializeMailboxPolicyDefaults } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  confirmPolicyWrite,
  failPolicyWrite,
  getPolicyReconciliation,
} from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;

const BETA_POLICY_OFFCHAIN = {
  allowUnknown: true,
  requireVerified: false,
  minimumPostage: "0",
};

describe("getPolicyReconciliation (BETA-023 / Issue #1930)", () => {
  it("reports not_provisioned when the owner has no stored policy", async () => {
    const repository = new MemoryApiRepository();

    const result = await getPolicyReconciliation(repository, owner);

    expect(result.state).toBe("not_provisioned");
    expect(result.offchain.source).toBe("default");
    expect(result.writeIntent).toBeNull();
  });

  it("reports pending_write while the provisioning write is outstanding", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);

    const result = await getPolicyReconciliation(repository, owner);

    expect(result.state).toBe("pending_write");
    expect(result.writeIntent).toMatchObject({
      status: "pending",
      version: 1,
    });
  });

  it("reports pending_write for a failed (retryable) write", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await failPolicyWrite(repository, owner, "rpc down");

    const result = await getPolicyReconciliation(repository, owner);

    expect(result.state).toBe("pending_write");
    expect(result.writeIntent?.status).toBe("failed");
    expect(result.writeIntent?.failureCount).toBe(1);
  });

  it("treats a confirmed intent without chain state as synced", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner);

    expect(result.state).toBe("synced");
    expect(result.writeIntent?.status).toBe("confirmed");
  });

  it("reports chain_ahead when the contract is newer than the off-chain policy", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        ...BETA_POLICY_OFFCHAIN,
        minimumPostage: "500",
      },
      version: 4,
    });

    expect(result.state).toBe("chain_ahead");
    expect(result.chain.version).toBe(4);
  });

  it("reports diverged when versions match but policies differ", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        ...BETA_POLICY_OFFCHAIN,
        requireVerified: true,
      },
      version: 1,
    });

    expect(result.state).toBe("diverged");
  });

  it("reports pending_write when the contract lags the off-chain version", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner, {
      policy: BETA_POLICY_OFFCHAIN,
      version: 0,
    });

    expect(result.state).toBe("pending_write");
  });

  it("reports synced when versions and policies align", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner, {
      policy: BETA_POLICY_OFFCHAIN,
      version: 1,
    });

    expect(result.state).toBe("synced");
  });
});
