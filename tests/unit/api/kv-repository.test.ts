import { beforeEach, describe, expect, it } from "vitest";
import { HybridApiRepository } from "../../../src/server/api/kv-repository";
import type { MailboxPolicy, Postage, Receipt } from "../../../src/server/api/domain";

class MockKVNamespace {
  public store = new Map<string, string>();
  public puts: string[] = [];

  async get(key: string, type: "text" | "json") {
    const val = this.store.get(key);
    if (val === undefined) return null;
    if (type === "json") return JSON.parse(val);
    return val;
  }

  async put(key: string, value: string): Promise<void> {
    this.puts.push(key);
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

class MockStealthCoordinator {
  private storage = new Map<string, any>();

  async getIdempotencyRecord(key: string) {
    return this.storage.get(`idempotency:${key}`) ?? null;
  }
  async setIdempotencyRecord(key: string, record: any) {
    this.storage.set(`idempotency:${key}`, record);
  }
  async getCounter(key: string) {
    const ts = this.storage.get(`counter:${key}`) ?? [];
    return ts.length;
  }
  async incrementCounter(key: string, windowSeconds: number) {
    const now = Date.now();
    const ts = this.storage.get(`counter:${key}`) ?? [];
    const filtered = [...ts, now].filter((t) => now - t <= windowSeconds * 1000);
    this.storage.set(`counter:${key}`, filtered);
    return filtered.length;
  }
  async checkAndSetVersion(key: string, expectedVersion: string | undefined, nextVersion: string) {
    const current = this.storage.get(`version:${key}`);
    if (expectedVersion !== undefined) {
      if (current !== expectedVersion) {
        // Throw an error that acts/looks like ApiError (or we can just throw standard Error with properties)
        const err: any = new Error("Concurrency conflict: version mismatch");
        err.status = 409;
        err.code = "conflict";
        throw err;
      }
    }
    this.storage.set(`version:${key}`, nextVersion);
  }

  async getReceipt(messageId: string) {
    return this.receipts.get(messageId) ?? null;
  }

  async setReceipt(receipt: Receipt) {
    this.receipts.set(receipt.messageId, receipt);
    return receipt;
  }

  async createReceiptIfAbsent(receipt: Receipt) {
    const existing = this.receipts.get(receipt.messageId);
    if (existing) return { created: false, receipt: existing };

    this.receipts.set(receipt.messageId, receipt);
    return { created: true, receipt };
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now = new Date(),
  ): Promise<import("../../../src/server/api/repository").MarkReceiptReadResult> {
    const receipt = this.receipts.get(messageId);
    if (!receipt) return { outcome: "not-found" };
    if (actor !== receipt.sender && actor !== receipt.recipient) {
      return { outcome: "forbidden" };
    }
    if (receipt.readAt) return { outcome: "already-read", readAt: receipt.readAt };

    const updated = { ...receipt, readAt: now.toISOString() };
    this.receipts.set(messageId, updated);
    return { outcome: "marked", receipt: updated };
  }
}

class MockDurableObjectNamespace {
  private readonly stub = new MockStealthCoordinator();
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
    expect(retrieved).toMatchObject(policy);
    expect(retrieved?.version).toBeDefined();
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
    expect(retrieved).toMatchObject(postage);
    expect(retrieved?.version).toBeDefined();
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
    expect(retrieved).toMatchObject(receipt);
    expect(retrieved?.version).toBeDefined();
  });

  it("mirrors only first receipt delivery and read transitions to KV", async () => {
    const receipt: Receipt = {
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId,
      readAt: null,
      recipient: owner,
      sender,
    };

    await expect(repo.createReceiptIfAbsent(receipt)).resolves.toEqual({
      created: true,
      receipt,
    });
    await expect(
      repo.createReceiptIfAbsent({ ...receipt, deliveredAt: "2026-06-14T12:05:00.000Z" }),
    ).resolves.toEqual({ created: false, receipt });

    const readReceipt = { ...receipt, readAt: "2026-06-14T12:30:00.000Z" };
    await expect(
      repo.markReceiptRead(messageId, owner, new Date(readReceipt.readAt!)),
    ).resolves.toEqual({
      outcome: "marked",
      receipt: readReceipt,
    });
    await expect(
      repo.markReceiptRead(messageId, owner, new Date("2026-06-14T12:45:00.000Z")),
    ).resolves.toEqual({
      outcome: "already-read",
      readAt: readReceipt.readAt,
    });
    expect(kv.puts.filter((key) => key === `receipt:${messageId}`)).toHaveLength(2);
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
