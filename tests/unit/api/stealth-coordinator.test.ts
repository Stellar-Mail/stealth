import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  return {
    DurableObject: class DurableObject {
      ctx: any;
      env: any;
      constructor(ctx: any, env: any) {
        this.ctx = ctx;
        this.env = env;
      }
    },
  };
});

import { StealthCoordinator } from "../../../src/server/api/stealth-coordinator";
import type { IdempotencyRecord, Postage, Receipt } from "../../../src/server/api/domain";

class MockDurableObjectState {
  public id = { toString: () => "mock-do-id" };
  public storage = {
    store: new Map<string, any>(),
    async get(key: string) {
      return this.store.get(key);
    },
    async put(key: string, value: any) {
      this.store.set(key, value);
    },
    async delete(key: string) {
      return this.store.delete(key);
    },
  };
}

describe("StealthCoordinator - Durable Object Operations", () => {
  let state: MockDurableObjectState;
  let coordinator: StealthCoordinator;

  beforeEach(() => {
    state = new MockDurableObjectState();
    coordinator = new StealthCoordinator(state as any, {});
  });

  it("handles idempotency records", async () => {
    const record: IdempotencyRecord = {
      state: "completed",
      body: { ok: true },
      requestDigest: "digest-1",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 201,
    };

    expect(await coordinator.getIdempotencyRecord("key-1")).toBeNull();
    await coordinator.setIdempotencyRecord("key-1", record);
    expect(await coordinator.getIdempotencyRecord("key-1")).toEqual(record);
  });

  describe("idempotency lease acquisition (issue #1498)", () => {
    it("acquires, blocks concurrent followers, and replays after completion", async () => {
      const first = await coordinator.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
      expect(first).toEqual({ status: "acquired" });

      const second = await coordinator.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
      expect(second).toEqual({ status: "in_progress" });

      await coordinator.setIdempotencyRecord("key-2", {
        state: "completed",
        status: 200,
        body: { ok: true },
        requestDigest: "digest-a",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const third = await coordinator.acquireIdempotencyRecord("key-2", "digest-a", 30_000);
      expect(third).toMatchObject({
        status: "completed",
        record: { body: { ok: true } },
      });
    });

    it("returns conflict when the same key is reused with a different payload digest", async () => {
      await coordinator.acquireIdempotencyRecord("key-3", "digest-a", 30_000);

      const mismatchWhileInProgress = await coordinator.acquireIdempotencyRecord(
        "key-3",
        "digest-b",
        30_000,
      );
      expect(mismatchWhileInProgress).toEqual({ status: "conflict" });

      await coordinator.setIdempotencyRecord("key-3", {
        state: "completed",
        status: 200,
        body: { ok: true },
        requestDigest: "digest-a",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const mismatchAfterCompletion = await coordinator.acquireIdempotencyRecord(
        "key-3",
        "digest-b",
        30_000,
      );
      expect(mismatchAfterCompletion).toEqual({ status: "conflict" });
    });

    it("survives independent API contexts sharing the same durable storage", async () => {
      // Simulates two separate Worker invocations reaching the same Durable
      // Object storage: a fresh StealthCoordinator instance, backed by the
      // same underlying storage, must observe state left by the other.
      await coordinator.acquireIdempotencyRecord("key-4", "digest-a", 30_000);
      await coordinator.setIdempotencyRecord("key-4", {
        state: "completed",
        status: 200,
        body: { settled: true },
        requestDigest: "digest-a",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });

      const independentContext = new StealthCoordinator(state as any, {});
      const replay = await independentContext.acquireIdempotencyRecord("key-4", "digest-a", 30_000);
      expect(replay).toMatchObject({
        status: "completed",
        record: { body: { settled: true } },
      });
    });
  });

  it("handles counter sliding window rate-limiting", async () => {
    expect(await coordinator.getCounter("limiter-1")).toBe(0);

    const now = Date.now();
    const dateSpy = vi.spyOn(Date, "now");

    // First increment at T = 0
    dateSpy.mockReturnValue(now);
    expect(await coordinator.incrementCounter("limiter-1", 60)).toBe(1);

    // Second increment at T = 10s
    dateSpy.mockReturnValue(now + 10000);
    expect(await coordinator.incrementCounter("limiter-1", 60)).toBe(2);

    // Get counter should reflect current size (2)
    expect(await coordinator.getCounter("limiter-1")).toBe(2);

    // Third increment at T = 70s (this should drop the first timestamp at T = 0 since 70 - 0 = 70 > 60)
    dateSpy.mockReturnValue(now + 70000);
    expect(await coordinator.incrementCounter("limiter-1", 60)).toBe(2); // T=10s and T=70s remain

    // Get counter should reflect current size (2)
    expect(await coordinator.getCounter("limiter-1")).toBe(2);

    dateSpy.mockRestore();
  });

  it("creates receipts once and replays duplicate deliveries", async () => {
    const receipt: Receipt = {
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId: "a".repeat(64),
      readAt: null,
      recipient: `G${"A".repeat(55)}`,
      sender: `G${"B".repeat(55)}`,
    };
    const duplicate = { ...receipt, deliveredAt: "2026-06-14T12:05:00.000Z" };

    await expect(coordinator.createReceiptIfAbsent(receipt)).resolves.toEqual({
      created: true,
      receipt,
    });
    await expect(coordinator.createReceiptIfAbsent(duplicate)).resolves.toEqual({
      created: false,
      receipt,
    });
    await expect(coordinator.getReceipt(receipt.messageId)).resolves.toEqual(receipt);
  });

  it("marks receipts read once and replays duplicate reads", async () => {
    const receipt: Receipt = {
      deliveredAt: "2026-06-14T12:00:00.000Z",
      messageId: "b".repeat(64),
      readAt: null,
      recipient: `G${"A".repeat(55)}`,
      sender: `G${"B".repeat(55)}`,
    };
    const expected = { ...receipt, readAt: "2026-06-14T12:30:00.000Z" };

    await coordinator.setReceipt(receipt);

    await expect(
      coordinator.markReceiptRead(
        receipt.messageId,
        receipt.recipient,
        new Date("2026-06-14T12:30:00.000Z"),
      ),
    ).resolves.toEqual({ outcome: "marked", receipt: expected });
    await expect(
      coordinator.markReceiptRead(
        receipt.messageId,
        receipt.recipient,
        new Date("2026-06-14T12:45:00.000Z"),
      ),
    ).resolves.toEqual({ outcome: "already-read", readAt: expected.readAt });
  });

  describe("postage settlement transitions", () => {
    const recipient = `G${"A".repeat(55)}`;
    const sender = `G${"B".repeat(55)}`;
    const messageId = "a".repeat(64);

    const pendingPostage: Postage = {
      amount: "100",
      createdAt: "2026-01-01T00:00:00.000Z",
      messageId,
      paymentHash: "c".repeat(64),
      recipient,
      sender,
      status: "pending",
    };

    it("round-trips postage via get/set", async () => {
      expect(await coordinator.getPostage(messageId)).toBeNull();
      await coordinator.setPostage(pendingPostage);
      expect(await coordinator.getPostage(messageId)).toEqual(pendingPostage);
    });

    it("returns not-found when transitioning a record that was never set", async () => {
      expect(await coordinator.transitionPostage(messageId, "pending", "settled")).toEqual({
        outcome: "not-found",
      });
    });

    it("applies a valid pending -> settled transition exactly once", async () => {
      await coordinator.setPostage(pendingPostage);

      const applied = await coordinator.transitionPostage(messageId, "pending", "settled");
      expect(applied).toMatchObject({
        outcome: "applied",
        postage: { status: "settled" },
      });

      // A second attempt with the same expected status is now a conflict,
      // not a second settlement.
      const conflict = await coordinator.transitionPostage(messageId, "pending", "settled");
      expect(conflict).toMatchObject({
        outcome: "conflict",
        postage: { status: "settled" },
      });
    });

    it("only lets one of two concurrent settlement calls win", async () => {
      await coordinator.setPostage(pendingPostage);

      const [first, second] = await Promise.all([
        coordinator.transitionPostage(messageId, "pending", "settled"),
        coordinator.transitionPostage(messageId, "pending", "settled"),
      ]);

      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(["applied", "conflict"]);
      expect(await coordinator.getPostage(messageId)).toMatchObject({
        status: "settled",
      });
    });
  });
});
