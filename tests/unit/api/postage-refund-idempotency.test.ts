import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { resolvePostage, getPostage } from "../../../src/server/api/postage-service";
import { createApiContext } from "../../../src/server/api/context";
import {
  acquireIdempotency,
  recordIdempotency,
  type IdempotencyScope,
} from "../../../src/server/api/idempotency-service";

const recipient = `G${"A".repeat(55)}`;
const sender = `G${"B".repeat(55)}`;

const refundScope = (recipientAddress: string, key: string): IdempotencyScope => ({
  actor: recipientAddress,
  method: "POST",
  route: "POST /postage/{messageId}/refund",
  rawKey: key,
});

/** Mirrors the refund route: refund has no request body, so the message id is the payload. */
async function checkIdempotency(
  repository: MemoryApiRepository,
  recipientAddress: string,
  key: string,
  messageId: string,
) {
  const result = await acquireIdempotency(repository, refundScope(recipientAddress, key), {
    messageId,
  });
  return result.status === "completed" ? result.record : null;
}

describe("Postage Refund Idempotency", () => {
  describe("resolvePostage - deterministic terminal states", () => {
    it("returns deterministic error when refunding already-refunded postage", async () => {
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

      // First refund succeeds
      const firstResult = await resolvePostage(createApiContext(repository), messageId, "refunded");
      expect(firstResult.status).toBe("refunded");

      // Second refund attempt returns deterministic error
      await expect(
        resolvePostage(createApiContext(repository), messageId, "refunded"),
      ).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been refunded"),
        details: {
          currentStatus: "refunded",
          attemptedStatus: "refunded",
          messageId,
        },
      });

      // Third attempt also returns the same error (determinism)
      await expect(
        resolvePostage(createApiContext(repository), messageId, "refunded"),
      ).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been refunded"),
      });
    });

    it("returns deterministic error when refunding already-settled postage", async () => {
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

      // First settlement succeeds
      await resolvePostage(createApiContext(repository), messageId, "settled");

      // Attempt to refund already-settled postage
      await expect(
        resolvePostage(createApiContext(repository), messageId, "refunded"),
      ).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        message: expect.stringContaining("already been settled"),
        details: {
          currentStatus: "settled",
          attemptedStatus: "refunded",
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
        status: "refunded",
      });

      try {
        await resolvePostage(createApiContext(repository), messageId, "refunded");
        expect.fail("Should have thrown an error");
      } catch (error) {
        const apiError = error as {
          status: number;
          code: string;
          message: string;
          details: { currentStatus: string; attemptedStatus: string; messageId: string };
        };

        // Verify error provides actionable information
        expect(apiError.message).toContain("already been refunded");
        expect(apiError.message).toContain("escrow was previously returned");
        expect(apiError.details.currentStatus).toBe("refunded");
        expect(apiError.details.attemptedStatus).toBe("refunded");
        expect(apiError.details.messageId).toBe(messageId);
      }
    });
  });

  describe("resolvePostage - concurrent refund & settlement-versus-refund races", () => {
    it("only refunds once when multiple concurrent requests race with no idempotency key", async () => {
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
        Array.from({ length: 10 }, () =>
          resolvePostage(createApiContext(repository), messageId, "refunded"),
        ),
      );

      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

      // Exactly one refund side effect occurs.
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(9);

      for (const outcome of rejected) {
        if (outcome.status !== "rejected") continue;
        expect(outcome.reason).toMatchObject({
          status: 409,
          code: "conflict",
          details: { currentStatus: "refunded" },
        });
      }

      const finalState = await getPostage(repository, messageId);
      expect(finalState.status).toBe("refunded");
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
        resolvePostage(createApiContext(repository), messageId, "refunded"),
        resolvePostage(createApiContext(repository), messageId, "settled"),
      ]);

      const fulfilled = outcomes.filter((outcome) => outcome.status === "fulfilled");
      const rejected = outcomes.filter((outcome) => outcome.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const finalState = await getPostage(repository, messageId);
      expect(["settled", "refunded"]).toContain(finalState.status);
      if (fulfilled[0].status === "fulfilled") {
        expect(finalState.status).toBe(fulfilled[0].value.status);
      }
    });

    it("ensures refund cannot win after settlement has completed", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "x".repeat(64);

      await repository.setPostage({
        amount: "500",
        createdAt: "2026-06-14T23:00:00.000Z",
        messageId,
        paymentHash: "z".repeat(64),
        recipient,
        sender,
        status: "pending",
      });

      // Settle completes first
      await resolvePostage(createApiContext(repository), messageId, "settled");

      // Refund attempt fails with 409
      await expect(
        resolvePostage(createApiContext(repository), messageId, "refunded"),
      ).rejects.toMatchObject({
        status: 409,
        code: "conflict",
        details: {
          currentStatus: "settled",
          attemptedStatus: "refunded",
        },
      });

      // State remains settled
      const state = await getPostage(repository, messageId);
      expect(state.status).toBe("settled");
    });
  });

  describe("idempotency service integration", () => {
    it("records and replays successful refund", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "g".repeat(64);
      const idempotencyKey = "refund-request-001";

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
      const firstCheck = await checkIdempotency(repository, recipient, idempotencyKey, messageId);
      expect(firstCheck).toBeNull();

      // Perform refund
      const refundedPostage = await resolvePostage(
        createApiContext(repository),
        messageId,
        "refunded",
      );
      expect(refundedPostage.status).toBe("refunded");

      // Record the success for replay
      await recordIdempotency(
        repository,
        refundScope(recipient, idempotencyKey),
        { messageId },
        200,
        refundedPostage,
      );

      // Second request: idempotency record exists
      const secondCheck = await checkIdempotency(repository, recipient, idempotencyKey, messageId);
      expect(secondCheck).not.toBeNull();
      expect((secondCheck as any)?.status).toBe(200);
      expect((secondCheck as any)?.body).toEqual(refundedPostage);

      // Verify the recorded body matches the refunded postage
      const recordedBody = (secondCheck as any)?.body as typeof refundedPostage;
      expect(recordedBody.status).toBe("refunded");
      expect(recordedBody.messageId).toBe(messageId);
      expect(recordedBody.amount).toBe("250");
    });

    it("records and replays terminal-state errors (409)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "i".repeat(64);
      const idempotencyKey = "refund-request-002";

      // Create already-refunded postage
      await repository.setPostage({
        amount: "300",
        createdAt: "2026-06-14T16:00:00.000Z",
        messageId,
        paymentHash: "j".repeat(64),
        recipient,
        sender,
        status: "refunded",
      });

      // First attempt: refund fails with 409
      let capturedError: unknown;
      try {
        await resolvePostage(createApiContext(repository), messageId, "refunded");
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
      await recordIdempotency(
        repository,
        refundScope(recipient, idempotencyKey),
        { messageId },
        409,
        {
          error: {
            code: apiError.code,
            message: apiError.message,
            details: apiError.details,
          },
        },
      );

      // Second attempt: retrieve cached error
      const replayedRecord = await checkIdempotency(
        repository,
        recipient,
        idempotencyKey,
        messageId,
      );
      expect(replayedRecord).not.toBeNull();
      expect((replayedRecord as any)?.status).toBe(409);

      const replayedBody = (replayedRecord as any)?.body as {
        error: { code: string; message: string };
      };
      expect(replayedBody.error.code).toBe("conflict");
      expect(replayedBody.error.message).toContain("already been refunded");
    });

    it("ensures actor isolation - different actors cannot replay each other's refunds", async () => {
      const repository = new MemoryApiRepository();
      const recipient2 = `G${"C".repeat(55)}`;
      const idempotencyKey = "shared-key-refund-123";

      // Recipient 1 records a refund
      const messageId = "x".repeat(64);
      await recordIdempotency(
        repository,
        refundScope(recipient, idempotencyKey),
        { messageId },
        200,
        {
          messageId,
          status: "refunded",
        },
      );

      // Recipient 1 can retrieve their record
      const recipient1Check = await checkIdempotency(
        repository,
        recipient,
        idempotencyKey,
        messageId,
      );
      expect(recipient1Check).not.toBeNull();
      expect((recipient1Check as any)?.status).toBe(200);

      // Recipient 2 cannot see recipient 1's idempotency record (actor isolation)
      const recipient2Check = await checkIdempotency(
        repository,
        recipient2,
        idempotencyKey,
        messageId,
      );
      expect(recipient2Check).toBeNull();
    });
  });

  describe("retry scenarios - network failures", () => {
    it("handles retry after successful refund (same idempotency key)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "k".repeat(64);
      const idempotencyKey = "network-retry-refund-001";

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
      const firstResult = await resolvePostage(createApiContext(repository), messageId, "refunded");
      await recordIdempotency(
        repository,
        refundScope(recipient, idempotencyKey),
        { messageId },
        200,
        firstResult,
      );

      // Network failure occurs, client retries with same idempotency key
      const retryRecord = await checkIdempotency(repository, recipient, idempotencyKey, messageId);
      expect(retryRecord).not.toBeNull();
      expect((retryRecord as any)?.status).toBe(200);

      // The replayed response matches the original
      const replayedPostage = (retryRecord as any)?.body as typeof firstResult;
      expect(replayedPostage).toEqual(firstResult);
      expect(replayedPostage.status).toBe("refunded");

      // The underlying postage state remains refunded (no double-refunding)
      const currentState = await getPostage(repository, messageId);
      expect(currentState.status).toBe("refunded");
    });

    it("handles retry after terminal-state error (same idempotency key)", async () => {
      const repository = new MemoryApiRepository();
      const messageId = "m".repeat(64);
      const idempotencyKey = "network-retry-refund-002";

      // Postage already refunded by another process
      await repository.setPostage({
        amount: "500",
        createdAt: "2026-06-14T18:00:00.000Z",
        messageId,
        paymentHash: "n".repeat(64),
        recipient,
        sender,
        status: "refunded",
      });

      // First request fails with 409
      let firstError: unknown;
      try {
        await resolvePostage(createApiContext(repository), messageId, "refunded");
      } catch (error) {
        firstError = error;
      }

      const apiError = firstError as {
        status: number;
        code: string;
        message: string;
        details: unknown;
      };
      await recordIdempotency(
        repository,
        refundScope(recipient, idempotencyKey),
        { messageId },
        409,
        {
          error: {
            code: apiError.code,
            message: apiError.message,
            details: apiError.details,
          },
        },
      );

      // Network failure, client retries with same idempotency key
      const retryRecord = await checkIdempotency(repository, recipient, idempotencyKey, messageId);
      expect(retryRecord).not.toBeNull();
      expect((retryRecord as any)?.status).toBe(409);

      // The replayed error matches the original
      const replayedError = (retryRecord as any)?.body as {
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
      const key1 = "operation-refund-001";
      const key2 = "operation-refund-002";

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

      // Refund first postage with key1
      const result1 = await resolvePostage(createApiContext(repository), messageId1, "refunded");
      await recordIdempotency(
        repository,
        refundScope(recipient, key1),
        { messageId: messageId1 },
        200,
        result1,
      );

      // Refund second postage with key2
      const result2 = await resolvePostage(createApiContext(repository), messageId2, "refunded");
      await recordIdempotency(
        repository,
        refundScope(recipient, key2),
        { messageId: messageId2 },
        200,
        result2,
      );

      // Each key retrieves its own result
      const check1 = await checkIdempotency(repository, recipient, key1, messageId1);
      const check2 = await checkIdempotency(repository, recipient, key2, messageId2);

      expect((check1 as any)?.body).toEqual(result1);
      expect((check2 as any)?.body).toEqual(result2);
      expect(((check1 as any)?.body as typeof result1).messageId).toBe(messageId1);
      expect(((check2 as any)?.body as typeof result2).messageId).toBe(messageId2);
    });
  });

  describe("edge cases and validation", () => {
    it("handles missing postage gracefully", async () => {
      const repository = new MemoryApiRepository();
      const nonExistentMessageId = "z".repeat(64);

      await expect(
        resolvePostage(createApiContext(repository), nonExistentMessageId, "refunded"),
      ).rejects.toMatchObject({
        status: 404,
        code: "not_found",
        message: "Postage was not found",
      });
    });

    it("preserves postage data integrity across refund retries", async () => {
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

      // First refund
      const refunded = await resolvePostage(createApiContext(repository), messageId, "refunded");

      // Verify all fields preserved except status
      expect(refunded.amount).toBe(originalPostage.amount);
      expect(refunded.createdAt).toBe(originalPostage.createdAt);
      expect(refunded.messageId).toBe(originalPostage.messageId);
      expect(refunded.paymentHash).toBe(originalPostage.paymentHash);
      expect(refunded.recipient).toBe(originalPostage.recipient);
      expect(refunded.sender).toBe(originalPostage.sender);
      expect(refunded.status).toBe("refunded");

      // Retry attempt should see the same data
      const currentState = await getPostage(repository, messageId);
      expect(currentState).toEqual(refunded);
    });
  });
});
