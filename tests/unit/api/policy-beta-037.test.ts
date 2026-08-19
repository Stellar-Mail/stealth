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
} from "../../../src/server/api/policy-sync-service";
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
});
