import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { resolvePostage, getPostage } from "../../../src/server/api/postage-service";
import { checkIdempotency, recordIdempotency } from "../../../src/server/api/idempotency-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

describe("Postage Settlement Idempotency", () => {
  describe("resolvePostage - deterministic terminal states", () => {
    it("returns deterministic error when settling already-settled postage", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "a".repeat(64);

      await repository.setPostage({
        amount: "100",
        createdAt: "2026-06-14T12:00:00.000Z",
        messageId,
        paymentHash: "b".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // First settlement succeeds
      const firstResult = await resolvePostage(repository, messageId, "settled");
      expect(firstResult.status).toBe("settled");

      // Second settlement attempt returns deterministic error
      await expect(resolvePostage(repository, messageId, "settled")).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been settled"),
        details: {
          currentStatus: "settled",
          attemptedStatus: "settled",
          messageId,
        },
      });

      // Third attempt also returns the same error (determinism)
      await expect(resolvePostage(repository, messageId, "settled")).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been settled"),
      });
    });

    it("returns deterministic error when settling already-refunded postage", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "c".repeat(64);

      await repository.setPostage({
        amount: "150",
        createdAt: "2026-06-14T13:00:00.000Z",
        messageId,
        paymentHash: "d".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // First refund succeeds
      await resolvePostage(repository, messageId, "refunded");

      // Attempt to settle already-refunded postage
      await expect(resolvePostage(repository, messageId, "settled")).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been refunded"),
        details: {
          currentStatus: "refunded",
          attemptedStatus: "settled",
          messageId,
        },
      });
    });

    it("explains terminal state in error details for debugging", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "e".repeat(64);

      await repository.setPostage({
        amount: "200",
        createdAt: "2026-06-14T14:00:00.000Z",
        messageId,
        paymentHash: "f".repeat(64),
        recipient,
        sender,
        status: "settled",
      });

      try {
        await resolvePostage(repository, messageId, "settled");
        expect.fail("Should have thrown an error");
      } catch (error) {
        const apiError = error as {
          status: number;
          code: string;
          message: string;
          details: { currentStatus: string; attemptedStatus: string; messageId: string };
        };

        // Verify error provides actionable information
        expect(apiError.message).toContain("already been settled");
        expect(apiError.message).toContain("escrow was previously released");
        expect(apiError.details.currentStatus).toBe("settled");
        expect(apiError.details.attemptedStatus).toBe("settled");
        expect(apiError.details.messageId).toBe(messageId);
      }
    });
  });

  describe("resolvePostage - concurrent settlement (issue #1545)", () => {
    it("only settles once when multiple concurrent requests race with no idempotency key", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "y".repeat(64);

      await repository.setPostage({
        amount: "1000",
        createdAt: "2026-06-14T21:00:00.000Z",
        messageId,
        paymentHash: "u".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      const outcomes = await Promise.allSettled(
        Array.from({ length: 10 }, () => resolvePostage(repository, messageId, "settled")),
      );

      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

      // Exactly one settlement side effect occurs.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      for (const outcome of rejected) {
        if (outcome.status !== "rejected") continue;
        expect(outcome.reason).toMatchObject({
          status: 409,
          code: "conflict",
          details: { currentStatus: "settled" },
        });
      }

      const finalState = await getPostage(repository, messageId);
      expect(finalState.status).toBe("settled");
    });

    it("only allows one winner between a concurrent settle and refund race", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "v".repeat(64);

      await repository.setPostage({
        amount: "1200",
        createdAt: "2026-06-14T22:00:00.000Z",
        messageId,
        paymentHash: "w".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      const outcomes = await Promise.allSettled([
        resolvePostage(repository, messageId, "settled"),
        resolvePostage(repository, messageId, "refunded"),
      ]);

      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      expect(fulfilled).toHaveLength(1);

      const finalState = await getPostage(repository, messageId);
      // Whichever one won, the final state is a single deterministic terminal status.
      expect(["settled", "refunded"]).toContain(finalState.status);
      if (fulfilled[0].status === "fulfilled") {
        expect(finalState.status).toBe(fulfilled[0].value.status);
      }
    });
  });

  describe("idempotency service integration", () => {
    it("records and replays successful settlement", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "g".repeat(64);
      const idempotencyKey = "settlement-request-001";

      await repository.setPostage({
        amount: "250",
        createdAt: "2026-06-14T15:00:00.000Z",
        messageId,
        paymentHash: "h".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // First request: no idempotency record exists
      const firstCheck = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(firstCheck).toBeNull();

      // Perform settlement
      const settledPostage = await resolvePostage(repository, messageId, "settled");
      expect(settledPostage.status).toBe("settled");

      // Record the success for replay
      await recordIdempotency(repository, recipient, idempotencyKey, 200, settledPostage);

      // Second request: idempotency record exists
      const secondCheck = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(secondCheck).not.toBeNull();
      expect(secondCheck?.status).toBe(200);
      expect(secondCheck?.body).toEqual(settledPostage);

      // Verify the recorded body matches the settled postage
      const recordedBody = secondCheck?.body as typeof settledPostage;
      expect(recordedBody.status).toBe("settled");
      expect(recordedBody.messageId).toBe(messageId);
      expect(recordedBody.amount).toBe("250");
    });

    it("records and replays terminal-state errors (409)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "i".repeat(64);
      const idempotencyKey = "settlement-request-002";

      // Create already-settled postage
      await repository.setPostage({
        amount: "300",
        createdAt: "2026-06-14T16:00:00.000Z",
        messageId,
        paymentHash: "j".repeat(64),
        recipient,
        sender,
        status: "settled",
      });

      // First attempt: settlement fails with 409
      let capturedError: unknown;
      try {
        await resolvePostage(repository, messageId, "settled");
      } catch (error) {
        capturedError = error;
      }

      expect(capturedError).toMatchObject({
        status: 409,
        code: "conflict",
      });

      // Record the error for replay
      const apiError = capturedError as {
        status: number;
        code: string;
        message: string;
        details: unknown;
      };
      await recordIdempotency(repository, recipient, idempotencyKey, 409, {
        error: {
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
        },
      });

      // Second attempt: retrieve cached error
      const replayedRecord = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(replayedRecord).not.toBeNull();
      expect(replayedRecord?.status).toBe(409);

      const replayedBody = replayedRecord?.body as { error: { code: string; message: string } };
      expect(replayedBody.error.code).toBe("conflict");
      expect(replayedBody.error.message).toContain("already been settled");
    });

    it("ensures actor isolation - different actors cannot replay each other's settlements", async () => {
      const repository = new MemoryApiRepository();
      const recipient2 = `G${"C".repeat(55)}`;
      const idempotencyKey = "shared-key-123";

      // Recipient 1 records a settlement
      await recordIdempotency(repository, recipient, idempotencyKey, 200, {
        messageId: "x".repeat(64),
        status: "settled",
      });

      // Recipient 1 can retrieve their record
      const recipient1Check = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(recipient1Check).not.toBeNull();
      expect(recipient1Check?.status).toBe(200);

      // Recipient 2 cannot see recipient 1's idempotency record (actor isolation)
      const recipient2Check = await checkIdempotency(repository, recipient2, idempotencyKey);
      expect(recipient2Check).toBeNull();
    });
  });

  describe("retry scenarios - network failures", () => {
    it("handles retry after successful settlement (same idempotency key)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "k".repeat(64);
      const idempotencyKey = "network-retry-001";

      await repository.setPostage({
        amount: "400",
        createdAt: "2026-06-14T17:00:00.000Z",
        messageId,
        paymentHash: "l".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // First request completes successfully
      const firstResult = await resolvePostage(repository, messageId, "settled");
      await recordIdempotency(repository, recipient, idempotencyKey, 200, firstResult);

      // Network failure occurs, client retries with same idempotency key
      const retryRecord = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(retryRecord).not.toBeNull();
      expect(retryRecord?.status).toBe(200);

      // The replayed response matches the original
      const replayedPostage = retryRecord?.body as typeof firstResult;
      expect(replayedPostage).toEqual(firstResult);
      expect(replayedPostage.status).toBe("settled");

      // The underlying postage state remains settled (no double-settlement)
      const currentState = await getPostage(repository, messageId);
      expect(currentState.status).toBe("settled");
    });

    it("handles retry after terminal-state error (same idempotency key)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "m".repeat(64);
      const idempotencyKey = "network-retry-002";

      // Postage already settled by another process
      await repository.setPostage({
        amount: "500",
        createdAt: "2026-06-14T18:00:00.000Z",
        messageId,
        paymentHash: "n".repeat(64),
        recipient,
        sender,
        status: "settled",
      });

      // First request fails with 409
      let firstError: unknown;
      try {
        await resolvePostage(repository, messageId, "settled");
      } catch (error) {
        firstError = error;
      }

      const apiError = firstError as {
        status: number;
        code: string;
        message: string;
        details: unknown;
      };
      await recordIdempotency(repository, recipient, idempotencyKey, 409, {
        error: {
          code: apiError.code,
          message: apiError.message,
          details: apiError.details,
        },
      });

      // Network failure, client retries with same idempotency key
      const retryRecord = await checkIdempotency(repository, recipient, idempotencyKey);
      expect(retryRecord).not.toBeNull();
      expect(retryRecord?.status).toBe(409);

      // The replayed error matches the original
      const replayedError = retryRecord?.body as {
        error: { code: string; message: string; details: unknown };
      };
      expect(replayedError.error.code).toBe("conflict");
      expect(replayedError.error.message).toBe(apiError.message);
      expect(replayedError.error.details).toEqual(apiError.details);
    });

    it("allows different operations with different idempotency keys", async () => {
      const repository = new MemoryApiRepository();
      const messageId1 = "o".repeat(64);
      const messageId2 = "p".repeat(64);
      const key1 = "operation-001";
      const key2 = "operation-002";

      // Create two pending postages
      await repository.setPostage({
        amount: "600",
        createdAt: "2026-06-14T19:00:00.000Z",
        messageId: messageId1,
        paymentHash: "q".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      await repository.setPostage({
        amount: "700",
        createdAt: "2026-06-14T19:01:00.000Z",
        messageId: messageId2,
        paymentHash: "r".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // Settle first postage with key1
      const result1 = await resolvePostage(repository, messageId1, "settled");
      await recordIdempotency(repository, recipient, key1, 200, result1);

      // Settle second postage with key2
      const result2 = await resolvePostage(repository, messageId2, "settled");
      await recordIdempotency(repository, recipient, key2, 200, result2);

      // Each key retrieves its own result
      const check1 = await checkIdempotency(repository, recipient, key1);
      const check2 = await checkIdempotency(repository, recipient, key2);

      expect(check1?.body).toEqual(result1);
      expect(check2?.body).toEqual(result2);
      expect((check1?.body as typeof result1).messageId).toBe(messageId1);
      expect((check2?.body as typeof result2).messageId).toBe(messageId2);
    });
  });

  describe("edge cases and validation", () => {
    it("handles missing postage gracefully", async () => {
      const repository = new MemoryApiRepository();
      const nonExistentMessageId = "z".repeat(64);

      await expect(
        resolvePostage(repository, nonExistentMessageId, "settled"),
      ).rejects.toMatchObject({
        status: 404,
        code: "not_found",
        message: "Postage was not found",
      });
    });

    it("preserves postage data integrity across settlement retries", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "s".repeat(64);

      const originalPostage = {
        amount: "800",
        createdAt: "2026-06-14T20:00:00.000Z",
        messageId,
        paymentHash: "t".repeat(64),
        recipient,
        sender,
        status: "pending" as const,
      };

      await repository.setPostage(originalPostage);

      // First settlement
      const settled = await resolvePostage(repository, messageId, "settled");

      // Verify all fields preserved except status
      expect(settled.amount).toBe(originalPostage.amount);
      expect(settled.createdAt).toBe(originalPostage.createdAt);
      expect(settled.messageId).toBe(originalPostage.messageId);
      expect(settled.paymentHash).toBe(originalPostage.paymentHash);
      expect(settled.recipient).toBe(originalPostage.recipient);
      expect(settled.sender).toBe(originalPostage.sender);
      expect(settled.status).toBe("settled");

      // Retry attempt should see the same data
      const currentState = await getPostage(repository, messageId);
      expect(currentState).toEqual(settled);
    });
  });
});
