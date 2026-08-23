import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  getSenderRule,
  setSenderRule,
  scheduleSenderRuleWrite,
  getSenderRuleWriteIntent,
} from "../../../src/server/api/policy-service";
import {
  syncAllPendingPolicyWrites,
  syncSenderRuleWrite,
  syncVersionedSenderRuleRecord,
} from "../../../src/server/api/policy-sync-service";
import { createOrUpdateSenderRule } from "../../../src/server/api/sender-rule-service";
import {
  InMemoryPolicyChainClient,
  setPolicyChainClient,
} from "../../../src/services/stellar/policy-chain-client";

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("BETA-037 sender rule persistence and chain sync", () => {
  let repository: MemoryApiRepository;
  let chainClient: InMemoryPolicyChainClient;

  beforeEach(() => {
    repository = new MemoryApiRepository();
    chainClient = new InMemoryPolicyChainClient();
    setPolicyChainClient(chainClient);
  });

  afterEach(() => {
    setPolicyChainClient(null);
  });

  it("persists sender rules with monotonic versions", async () => {
    const first = await setSenderRule(repository, owner, sender, "allow");
    const second = await setSenderRule(repository, owner, sender, "block");

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    await expect(getSenderRule(repository, owner, sender)).resolves.toMatchObject({
      rule: "block",
      version: 2,
      sync: "pending",
    });
  });

  it("rejects stale expectedVersion with conflict", async () => {
    await setSenderRule(repository, owner, sender, "allow");

    await expect(
      setSenderRule(repository, owner, sender, "block", { expectedVersion: 0 }),
    ).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("schedules durable write intents for sender rule mutations", async () => {
    await setSenderRule(repository, owner, sender, "block");
    const intent = await getSenderRuleWriteIntent(repository, owner, sender);
    expect(intent).toMatchObject({
      owner,
      sender,
      rule: "block",
      status: "pending",
      offchainVersion: 1,
    });
  });

  it("retries failed chain writes at the same version", async () => {
    await scheduleSenderRuleWrite(repository, owner, sender, "allow");
    chainClient.failNextSubmit = true;
    await expect(
      syncSenderRuleWrite(repository, owner, sender, "req-1", { chainClient }),
    ).resolves.toMatchObject({ status: "failed" });

    const failed = await getSenderRuleWriteIntent(repository, owner, sender);
    expect(failed?.status).toBe("failed");
    expect(failed?.offchainVersion).toBe(1);

    chainClient.failNextSubmit = false;
    await expect(
      syncSenderRuleWrite(repository, owner, sender, "req-2", { chainClient }),
    ).resolves.toMatchObject({ status: "synced" });

    const confirmed = await getSenderRuleWriteIntent(repository, owner, sender);
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.offchainVersion).toBe(1);
    expect(await chainClient.readSenderRule(owner, sender)).toBe("allow");
  });

  it("emits audit events on chain confirmation", async () => {
    const auditSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await setSenderRule(repository, owner, sender, "block");
    await syncSenderRuleWrite(repository, owner, sender, "audit-req", { chainClient });

    const auditLine = auditSpy.mock.calls
      .map((call) => call[0])
      .find((line) => typeof line === "string" && line.includes("policy.sender_rule.confirmed"));
    expect(auditLine).toBeDefined();
    auditSpy.mockRestore();
  });

  it("syncAllPendingPolicyWrites drains mailbox and sender intents", async () => {
    await setSenderRule(repository, owner, sender, "allow");
    const results = await syncAllPendingPolicyWrites(repository, owner, "batch", { chainClient });
    expect(results.some((result) => result.kind === "sender" && result.status === "synced")).toBe(
      true,
    );
  });

  it("syncs price sender rules via set_sender_tier", async () => {
    await scheduleSenderRuleWrite(repository, owner, sender, "price", {
      minimumPostage: "1000000",
    });
    await expect(
      syncSenderRuleWrite(repository, owner, sender, "price-req", { chainClient }),
    ).resolves.toMatchObject({ status: "synced" });
    expect(await chainClient.readSenderTier(owner, sender)).toBe("1000000");
  });

  it("wires versioned sender-rule CRUD through chain sync", async () => {
    const created = await createOrUpdateSenderRule(repository, owner, sender, {
      rule: "block",
    });
    const synced = await syncVersionedSenderRuleRecord(repository, created.rule, "api-put", {
      chainClient,
    });
    expect(synced.chainStatus).toBe("confirmed");
    expect(synced.txHash).toBeTruthy();
    expect(await chainClient.readSenderRule(owner, sender)).toBe("block");
  });

  it("clears on-chain overrides before confirming verify sender rules", async () => {
    chainClient.seedSenderRule(owner, sender, "block");
    chainClient.seedSenderTier(owner, sender, "1000000");
    const created = await createOrUpdateSenderRule(repository, owner, sender, {
      rule: "verify",
    });
    const synced = await syncVersionedSenderRuleRecord(repository, created.rule, "verify-put", {
      chainClient,
    });
    expect(synced.chainStatus).toBe("confirmed");
    expect(await chainClient.readSenderRule(owner, sender)).toBe("default");
    expect(await chainClient.readSenderTier(owner, sender)).toBeNull();
    expect(chainClient.submitCalls).toBeGreaterThan(0);
  });
});
