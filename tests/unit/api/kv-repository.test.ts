import { beforeEach, describe, expect, it } from "vitest";
import { HybridApiRepository } from "../../../src/server/api/kv-repository";
import type { MailboxPolicy, Postage, Receipt } from "../../../src/server/api/domain";

class MockKVNamespace {
  public store = new Map<string, string>();

  async get(key: string, type: "text" | "json") {
    const val = this.store.get(key);
    if (val === undefined) return null;
    if (type === "json") return JSON.parse(val);
    return val;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class MockCoordinatorStub {
  private postage = new Map<string, Postage>();

  async getPostage(messageId: string) {
    return this.postage.get(messageId) ?? null;
  }

  async setPostage(postage: Postage) {
    this.postage.set(postage.messageId, postage);
    return postage;
  }

  async transitionPostage(messageId: string, expectedStatus: string, nextStatus: string) {
    const current = this.postage.get(messageId);
    if (!current) return { outcome: "not-found" as const };
    if (current.status !== expectedStatus) {
      return { outcome: "conflict" as const, postage: current };
    }
    const updated = { ...current, status: nextStatus } as Postage;
    this.postage.set(messageId, updated);
    return { outcome: "applied" as const, postage: updated };
  }
}

class MockDurableObjectNamespace {
  public stub = new MockCoordinatorStub();

  idFromName(name: string) {
    return { toString: () => name };
  }
  get(id: any) {
    return this.stub;
  }
}

const owner = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;
const messageId = "a".repeat(64);

describe("HybridApiRepository - KV Operations", () => {
  let kv: MockKVNamespace;
  let coordinator: MockDurableObjectNamespace;
  let repo: HybridApiRepository;

  beforeEach(() => {
    kv = new MockKVNamespace();
    coordinator = new MockDurableObjectNamespace();
    repo = new HybridApiRepository(kv as any, coordinator as any);
  });

  it("persists and retrieves mailbox policy", async () => {
    const policy: MailboxPolicy = {
      allowUnknown: true,
      minimumPostage: "100",
      requireVerified: false,
    };
    await repo.setPolicy(owner, policy);
    const retrieved = await repo.getPolicy(owner);
    expect(retrieved).toEqual(policy);
  });

  it("returns null for non-existent policy", async () => {
    const retrieved = await repo.getPolicy(owner);
    expect(retrieved).toBeNull();
  });

  it("persists, retrieves, and deletes sender rules", async () => {
    expect(await repo.getSenderRule(owner, sender)).toBe("default");

    await repo.setSenderRule(owner, sender, "allow");
    expect(await repo.getSenderRule(owner, sender)).toBe("allow");

    await repo.setSenderRule(owner, sender, "default");
    expect(await repo.getSenderRule(owner, sender)).toBe("default");
    expect(kv.store.has(`sender-rule:${owner}:${sender}`)).toBe(false);
  });

  it("persists and retrieves postage", async () => {
    const postage: Postage = {
      amount: "200",
      createdAt: new Date().toISOString(),
      messageId,
      paymentHash: "b".repeat(64),
      recipient: owner,
      sender,
      status: "pending",
    };
    await repo.setPostage(postage);
    const retrieved = await repo.getPostage(messageId);
    expect(retrieved).toEqual(postage);
  });

  it("persists and retrieves receipt", async () => {
    const receipt: Receipt = {
      deliveredAt: new Date().toISOString(),
      messageId,
      readAt: null,
      recipient: owner,
      sender,
    };
    await repo.setReceipt(receipt);
    const retrieved = await repo.getReceipt(messageId);
    expect(retrieved).toEqual(receipt);
  });

  it("returns defaults/0 for relay stubs", async () => {
    expect(await repo.getRelayQueueDepth("relay-1")).toBe(0);
    expect(await repo.getRelayRetryCount("relay-1")).toBe(0);
    expect(await repo.getRelayLastSuccessfulDelivery("relay-1")).toBeNull();
    expect(await repo.getRelayLastFailedDelivery("relay-1")).toBeNull();
    expect(await repo.getRelayDeadLetterCount("relay-1")).toBe(0);
  });

  describe("transitionPostage - atomic settlement", () => {
    it("delegates to the coordinator and mirrors the applied result back into KV", async () => {
      const postage: Postage = {
        amount: "200",
        createdAt: new Date().toISOString(),
        messageId,
        paymentHash: "b".repeat(64),
        recipient: owner,
        sender,
        status: "pending",
      };
      await repo.setPostage(postage);

      const result = await repo.transitionPostage(messageId, "pending", "settled");

      expect(result).toMatchObject({ outcome: "applied", postage: { status: "settled" } });
      // KV read path reflects the coordinator's authoritative outcome.
      await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
    });

    it("returns not-found when there is no coordinator record", async () => {
      const result = await repo.transitionPostage(messageId, "pending", "settled");
      expect(result).toEqual({ outcome: "not-found" });
    });

    it("only allows one of two concurrent settlement attempts to succeed", async () => {
      const postage: Postage = {
        amount: "300",
        createdAt: new Date().toISOString(),
        messageId,
        paymentHash: "c".repeat(64),
        recipient: owner,
        sender,
        status: "pending",
      };
      await repo.setPostage(postage);

      const [first, second] = await Promise.all([
        repo.transitionPostage(messageId, "pending", "settled"),
        repo.transitionPostage(messageId, "pending", "settled"),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(["applied", "conflict"]);

      // Only one settlement side effect occurred; state is deterministic.
      await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
    });
  });
});
