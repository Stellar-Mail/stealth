import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  betaDefaultMailboxPolicy,
  confirmPolicyWrite,
  failPolicyWrite,
  getPolicyWriteIntent,
  schedulePolicyWrite,
  submitPolicyWrite,
} from "../../../src/server/api/policy-service";

const owner = `G${"A".repeat(55)}`;

describe("policy write intents (BETA-023 / Issue #1930)", () => {
  it("schedules a fresh pending intent at off-chain version 1", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      owner,
      policy: betaDefaultMailboxPolicy,
      offchainVersion: 1,
      status: "pending",
      failureCount: 0,
    });
  });

  it("re-scheduling the identical policy never bumps the version", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.offchainVersion).toBe(1);
  });

  it("a genuinely different policy bumps the version by exactly one", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await schedulePolicyWrite(repository, owner, {
      ...betaDefaultMailboxPolicy,
      minimumPostage: "100",
    });

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.offchainVersion).toBe(2);
    expect(intent?.policy.minimumPostage).toBe("100");
  });

  it("re-arms a failed intent at the same version (retry, not a new change)", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await failPolicyWrite(repository, owner, "soroban rpc unavailable");
    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      status: "pending",
      offchainVersion: 1,
      lastError: null,
    });
  });

  it("advances an intent through pending -> submitted -> confirmed", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await submitPolicyWrite(repository, owner);

    let intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.status).toBe("submitted");

    await confirmPolicyWrite(repository, owner, "tx-abc");
    intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      status: "confirmed",
      txHash: "tx-abc",
    });
  });

  it("records sanitized, bounded failure reasons", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await failPolicyWrite(repository, owner, "seed=super-secret\nline2");

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent).toMatchObject({
      status: "failed",
      failureCount: 1,
    });
    expect(intent?.lastError).toBe("seed=super-secret line2");
  });

  it("a failed intent reports its version as-is (never bumped on failure)", async () => {
    const repository = new MemoryApiRepository();

    await schedulePolicyWrite(repository, owner, betaDefaultMailboxPolicy);
    await failPolicyWrite(repository, owner, "boom");

    const intent = await getPolicyWriteIntent(repository, owner);
    expect(intent?.offchainVersion).toBe(1);
  });
});
