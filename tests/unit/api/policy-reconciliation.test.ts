import { describe, expect, it } from "vitest";

import { initializeMailboxPolicyDefaults } from "../../../src/server/api/account-provisioning";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  confirmPolicyWrite,
  failPolicyWrite,
  getPolicyReconciliation,
  getSenderRuleReconciliation,
  scheduleSenderRuleWrite,
} from "../../../src/server/api/policy-service";
import { createOrUpdateSenderRule } from "../../../src/server/api/sender-rule-service";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

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

  // -------------------------------------------------------------------
  // BETA-041 boundary / malformed-input cases
  // -------------------------------------------------------------------

  it("treats null chain state as synced when intent is confirmed", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    const result = await getPolicyReconciliation(repository, owner, {});
    expect(result.state).toBe("synced");
    expect(result.chain.version).toBeNull();
    expect(result.chain.policy).toBeNull();
  });

  it("reports synced when chain version is ahead but policy content matches (sender-rule version bump)", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    // Chain version 100 but policy content matches the off-chain beta defaults.
    // A sender-rule write bumped the global version without changing the mailbox
    // policy — this must NOT be reported as chain_ahead (BETA-041 review fix).
    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0",
      },
      version: 100,
    });
    expect(result.state).toBe("synced");
    expect(result.chain.version).toBe(100);
  });

  it("reports chain_ahead when chain version is ahead AND policy content differs", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    // Chain version 100 with a different policy → true chain_ahead
    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        allowUnknown: false,
        requireVerified: true,
        minimumPostage: "999",
      },
      version: 100,
    });
    expect(result.state).toBe("chain_ahead");
    expect(result.chain.version).toBe(100);
  });

  it("reports synced when confirmed intent version matches chain version and policies align", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    // Provisioning creates intent at version 1; confirm it.
    await confirmPolicyWrite(repository, owner, "tx-1");

    // Chain at version 1 with matching beta-default policies → synced
    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0",
      },
      version: 1,
    });
    expect(result.state).toBe("synced");
  });

  it("reports diverged when requireReceipt differs between chain and off-chain intent", async () => {
    const repository = new MemoryApiRepository();
    await initializeMailboxPolicyDefaults(repository, owner);
    await confirmPolicyWrite(repository, owner, "tx-1");

    // Chain says requireReceipt=true but the off-chain intent has
    // requireReceipt=false (default).  The three-field MailboxPolicy
    // matches, but the fourth field diverges → diverged.
    const result = await getPolicyReconciliation(repository, owner, {
      policy: {
        allowUnknown: true,
        requireVerified: false,
        minimumPostage: "0",
      },
      version: 1,
      requireReceipt: true,
    });
    expect(result.state).toBe("diverged");
  });
});

// -------------------------------------------------------------------
// Sender-rule reconciliation boundary cases (BETA-041)
// -------------------------------------------------------------------

describe("getSenderRuleReconciliation boundary cases (BETA-041)", () => {
  it("reports synced when no local rule and no chain rule", async () => {
    const repository = new MemoryApiRepository();

    const result = await getSenderRuleReconciliation(repository, owner, sender, null);
    expect(result.state).toBe("synced");
    expect(result.offchain.rule).toBe("default");
    expect(result.chain.rule).toBeNull();
  });

  it("reports drift when chain has a rule but local does not", async () => {
    const repository = new MemoryApiRepository();

    const result = await getSenderRuleReconciliation(repository, owner, sender, "allow");
    expect(result.state).toBe("diverged");
    expect(result.offchain.rule).toBe("default");
    expect(result.chain.rule).toBe("allow");
  });

  it("reports pending_write when a sender-rule write is outstanding", async () => {
    const repository = new MemoryApiRepository();
    await scheduleSenderRuleWrite(repository, owner, sender, "block");

    const result = await getSenderRuleReconciliation(repository, owner, sender, null);
    expect(result.state).toBe("pending_write");
    expect(result.writeIntent?.status).toBe("pending");
  });

  it("reports synced when chain rule matches local rule", async () => {
    const repository = new MemoryApiRepository();
    await createOrUpdateSenderRule(repository, owner, sender, { rule: "allow" });

    const result = await getSenderRuleReconciliation(repository, owner, sender, "allow");
    expect(result.state).toBe("synced");
    expect(result.offchain.rule).toBe("allow");
    expect(result.chain.rule).toBe("allow");
  });

  it("reports drift when local rule differs from chain rule", async () => {
    const repository = new MemoryApiRepository();
    await createOrUpdateSenderRule(repository, owner, sender, { rule: "allow" });

    const result = await getSenderRuleReconciliation(repository, owner, sender, "block");
    expect(result.state).toBe("diverged");
    expect(result.offchain.rule).toBe("allow");
    expect(result.chain.rule).toBe("block");
  });
});
