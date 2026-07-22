import { beforeEach, describe, expect, it } from "vitest";

import type { ApiRepository } from "../../../src/server/api/repository";

// Issue #1494: one reusable repository conformance suite that every adapter must
// satisfy, so memory and future production adapters cannot diverge on CRUD,
// ordering, conflict, and not-found semantics.
//
// `makeRepository` is an async factory so adapter-specific setup (connections,
// migrations, fixtures) is injected without changing the expected behavior.
export function runRepositoryContractTests(
  adapterName: string,
  makeRepository: () => Promise<ApiRepository> | ApiRepository,
) {
  const owner = `G${"A".repeat(55)}`;
  const sender = `G${"B".repeat(55)}`;
  const messageId = "a".repeat(64);
  const paymentHash = "b".repeat(64);

  describe(`ApiRepository contract: ${adapterName}`, () => {
    let repo: ApiRepository;

    beforeEach(async () => {
      repo = await makeRepository();
    });

    describe("policy CRUD", () => {
      it("returns null for a missing policy", async () => {
        await expect(repo.getPolicy(owner)).resolves.toBeNull();
      });

      it("round-trips a stored policy", async () => {
        await repo.setPolicy(owner, {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
      });

      it("overwrites an existing policy on repeated set", async () => {
        await repo.setPolicy(owner, {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        });
        await repo.setPolicy(owner, {
          allowUnknown: false,
          minimumPostage: "200",
          requireVerified: true,
        });
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          minimumPostage: "200",
          requireVerified: true,
        });
      });
    });

    describe("sender rules", () => {
      it("defaults to 'default' when no rule exists", async () => {
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("default");
      });

      it("stores and clears explicit rules", async () => {
        await repo.setSenderRule(owner, sender, "allow");
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("allow");

        await repo.setSenderRule(owner, sender, "default");
        await expect(repo.getSenderRule(owner, sender)).resolves.toBe("default");
      });

      it("isolates rules per (owner, sender) pair", async () => {
        const otherSender = `G${"C".repeat(55)}`;
        await repo.setSenderRule(owner, sender, "block");
        await expect(repo.getSenderRule(owner, otherSender)).resolves.toBe("default");
      });
    });

    describe("postage and receipt records", () => {
      it("returns null for missing postage and receipts", async () => {
        await expect(repo.getPostage(messageId)).resolves.toBeNull();
        await expect(repo.getReceipt(messageId)).resolves.toBeNull();
      });

      it("round-trips postage keyed by messageId", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({
          messageId,
          status: "pending",
        });
      });

      it("round-trips receipts keyed by messageId", async () => {
        await repo.setReceipt({
          deliveredAt: "2026-01-01T00:00:00.000Z",
          messageId,
          readAt: null,
          recipient: owner,
          sender,
        });
        await expect(repo.getReceipt(messageId)).resolves.toMatchObject({
          messageId,
          readAt: null,
        });
      });
    });

    describe("atomic postage transitions", () => {
      it("reports not-found for a message with no postage", async () => {
        await expect(repo.transitionPostage(messageId, "pending", "settled")).resolves.toEqual({
          outcome: "not-found",
        });
      });

      it("applies a pending -> settled transition and reflects it in getPostage", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });

        const result = await repo.transitionPostage(messageId, "pending", "settled");
        expect(result).toMatchObject({ outcome: "applied", postage: { status: "settled" } });
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
      });

      it("reports a conflict with the current status when already terminal", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "settled",
        });

        await expect(
          repo.transitionPostage(messageId, "pending", "settled"),
        ).resolves.toMatchObject({ outcome: "conflict", postage: { status: "settled" } });
      });

      it("allows exactly one winner out of concurrent settlement attempts", async () => {
        await repo.setPostage({
          amount: "100",
          createdAt: "2026-01-01T00:00:00.000Z",
          messageId,
          paymentHash,
          recipient: owner,
          sender,
          status: "pending",
        });

        const results = await Promise.all(
          Array.from({ length: 5 }, () => repo.transitionPostage(messageId, "pending", "settled")),
        );

        const applied = results.filter((result) => result.outcome === "applied");
        const conflicts = results.filter((result) => result.outcome === "conflict");
        expect(applied).toHaveLength(1);
        expect(conflicts).toHaveLength(4);
        await expect(repo.getPostage(messageId)).resolves.toMatchObject({ status: "settled" });
      });
    });

    describe("idempotency records", () => {
      it("returns null for a missing idempotency key", async () => {
        await expect(repo.getIdempotencyRecord("missing")).resolves.toBeNull();
      });

      it("round-trips an idempotency record", async () => {
        await repo.setIdempotencyRecord("key-1", {
          state: "completed",
          status: 200,
          body: { ok: true },
          createdAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
        });
        await expect(repo.getIdempotencyRecord("key-1")).resolves.toMatchObject({
          status: 200,
        });
      });
    });

    describe("counters", () => {
      it("starts at zero and increments within a window", async () => {
        await expect(repo.getCounter("rl:test")).resolves.toBe(0);
        const first = await repo.incrementCounter("rl:test", 60);
        const second = await repo.incrementCounter("rl:test", 60);
        expect(first).toBe(1);
        expect(second).toBe(2);
      });
    });

    describe("stored values are isolated from caller mutation", () => {
      it("does not reflect post-write mutation of the input object", async () => {
        const policy = {
          allowUnknown: true,
          minimumPostage: "100",
          requireVerified: false,
        };
        await repo.setPolicy(owner, policy);
        policy.minimumPostage = "999";
        await expect(repo.getPolicy(owner)).resolves.toMatchObject({
          minimumPostage: "100",
        });
      });
    });
  });
}
