import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "@/server/api/memory-repository";
import {
  calculateBackoff,
  classifyError,
  enqueueDurableJob,
  recordJobFailure,
  recordJobSuccess,
  redactErrorMessage,
  listDeadLetters,
  getDeadLetter,
  retryDeadLetter,
  abandonDeadLetter,
  indexReceiptEvents,
} from "@/server/api/job-service";
import type { DurableJob, DurableJobType, ReceiptEvent } from "@/server/api/domain";
import { ApiError } from "@/server/api/errors";
import { withIdempotency } from "@/server/api/idempotency-service";

const testSender = `G${"A".repeat(55)}`;
const testRecipient = `G${"B".repeat(55)}`;
const testMessageId = "a".repeat(64);

describe("Durable Jobs, Retries, DLQ, and Receipt Indexing (Issue #1952 BETA-045)", () => {
  describe("Job Definitions & Idempotent Enqueue", () => {
    it("defines durable jobs across all required domains", async () => {
      const repository = new MemoryApiRepository();
      const jobTypes: DurableJobType[] = [
        "funding",
        "anchoring",
        "postage",
        "delivery",
        "receipts",
        "cleanup",
        "reconciliation",
      ];

      for (const type of jobTypes) {
        const { enqueued, job } = await enqueueDurableJob(repository, {
          type,
          idempotencyKey: `key-${type}-001`,
          payload: { account: testSender, amount: "1000" },
        });

        expect(enqueued).toBe(true);
        expect(job.type).toBe(type);
        expect(job.status).toBe("pending");
        expect(job.attempts).toBe(0);
        expect(job.maxAttempts).toBe(5);
      }

      const allJobs = await repository.listJobs({ limit: 100 });
      expect(allJobs).toHaveLength(7);
    });

    it("suppresses duplicate enqueues with the same idempotency key", async () => {
      const repository = new MemoryApiRepository();
      const input = {
        type: "funding" as const,
        idempotencyKey: "unique-funding-key-999",
        payload: { account: testSender, amount: "50000" },
      };

      const first = await enqueueDurableJob(repository, input);
      expect(first.enqueued).toBe(true);

      const second = await enqueueDurableJob(repository, input);
      expect(second.enqueued).toBe(false);
      expect(second.job.jobId).toBe(first.job.jobId);

      const listed = await repository.listJobs({ type: "funding" });
      expect(listed).toHaveLength(1);
    });
  });

  describe("Reason Taxonomy & Redaction", () => {
    it("redacts sensitive Stellar seeds, bearer tokens, and private keys from error messages", () => {
      const sensitiveError = new Error(
        `Failed to submit tx: S${"A".repeat(55)} secret_key: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef with Bearer secret-token-xyz`,
      );

      const redacted = redactErrorMessage(sensitiveError);
      expect(redacted).not.toContain(`S${"A".repeat(55)}`);
      expect(redacted).not.toContain("secret-token-xyz");
      expect(redacted).not.toContain(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      );
      expect(redacted).toContain("[REDACTED_SEED]");
      expect(redacted).toContain("[REDACTED_TOKEN]");
      expect(redacted).toContain("[REDACTED_KEY]");
    });

    it("classifies transient vs permanent errors according to taxonomy", () => {
      expect(classifyError(new Error("ETIMEDOUT connection failed"))).toEqual({
        code: "ERR_RPC_TIMEOUT",
        retryable: true,
      });

      expect(classifyError(new Error("rate limit exceeded (429)"))).toEqual({
        code: "ERR_RATE_LIMITED",
        retryable: true,
      });

      expect(classifyError(new Error("Contract failed: custom revert"))).toEqual({
        code: "ERR_CONTRACT_REVERT",
        retryable: false,
      });

      expect(classifyError(new Error("Invalid poison payload structure"))).toEqual({
        code: "ERR_POISON_PAYLOAD",
        retryable: false,
      });

      expect(classifyError(new ApiError(401, "unauthorized", "Bad auth"))).toEqual({
        code: "ERR_UNAUTHORIZED",
        retryable: false,
      });
    });
  });

  describe("Exponential Backoff with Jitter", () => {
    it("calculates exponential delays with bounded jitter", () => {
      const b1 = calculateBackoff(1, 1000, 60000, 0.1);
      const b2 = calculateBackoff(2, 1000, 60000, 0.1);
      const b3 = calculateBackoff(3, 1000, 60000, 0.1);

      expect(b1).toBeGreaterThanOrEqual(1000);
      expect(b1).toBeLessThanOrEqual(1200);

      expect(b2).toBeGreaterThanOrEqual(2000);
      expect(b2).toBeLessThanOrEqual(2400);

      expect(b3).toBeGreaterThanOrEqual(4000);
      expect(b3).toBeLessThanOrEqual(4800);
    });

    it("respects the maximum backoff ceiling", () => {
      const b10 = calculateBackoff(10, 1000, 10000, 0.1);
      expect(b10).toBeLessThanOrEqual(11500);
    });
  });

  describe("Job Retries & Dead Letter Queue", () => {
    it("retries recoverable errors up to attempt ceiling, then dead-letters on exhaustion", async () => {
      const repository = new MemoryApiRepository();
      const { job } = await enqueueDurableJob(repository, {
        type: "anchoring",
        idempotencyKey: "anchor-retry-test",
        payload: { rootHash: "b".repeat(64) },
        maxAttempts: 3,
      });

      // Attempt 1: Transient failure -> pending (attempt 1)
      const res1 = await recordJobFailure(repository, job, new Error("Temporary network timeout"));
      expect(res1.job.status).toBe("pending");
      expect(res1.job.attempts).toBe(1);
      expect(res1.job.errorCode).toBe("ERR_RPC_TIMEOUT");
      expect(res1.deadLetter).toBeUndefined();

      // Attempt 2: Transient failure -> pending (attempt 2)
      const res2 = await recordJobFailure(
        repository,
        res1.job,
        new Error("Temporary network timeout"),
      );
      expect(res2.job.status).toBe("pending");
      expect(res2.job.attempts).toBe(2);
      expect(res2.deadLetter).toBeUndefined();

      // Attempt 3: Transient failure -> exhausted -> dead_letter
      const res3 = await recordJobFailure(
        repository,
        res2.job,
        new Error("Temporary network timeout"),
      );
      expect(res3.job.status).toBe("dead_letter");
      expect(res3.job.attempts).toBe(3);
      expect(res3.deadLetter).toBeDefined();
      expect(res3.deadLetter?.status).toBe("dead");
      expect(res3.deadLetter?.errorCode).toBe("ERR_RPC_TIMEOUT");

      const dlq = await repository.listDeadLetters();
      expect(dlq).toHaveLength(1);
      expect(dlq[0].jobId).toBe(job.jobId);
    });

    it("immediately moves poison / non-retryable jobs to dead-letter queue without blocking others", async () => {
      const repository = new MemoryApiRepository();

      // User 1 submits a poison job
      const { job: poisonJob } = await enqueueDurableJob(repository, {
        type: "delivery",
        idempotencyKey: "poison-job-user-1",
        payload: { recipient: testRecipient, payload: "bad-payload" },
      });

      // User 2 submits a normal valid job
      const { job: normalJob } = await enqueueDurableJob(repository, {
        type: "delivery",
        idempotencyKey: "normal-job-user-2",
        payload: { recipient: testRecipient, payload: "good-payload" },
      });

      // Poison job fails with non-retryable poison error
      const poisonResult = await recordJobFailure(
        repository,
        poisonJob,
        new Error("Invalid poison payload structure"),
      );
      expect(poisonResult.job.status).toBe("dead_letter");
      expect(poisonResult.deadLetter).toBeDefined();
      expect(poisonResult.deadLetter?.errorCode).toBe("ERR_POISON_PAYLOAD");

      // Normal job can now be claimed and succeeded without being blocked by poison job
      const claimed = await repository.claimNextPendingJob(["delivery"]);
      expect(claimed).not.toBeNull();
      expect(claimed?.jobId).toBe(normalJob.jobId);

      const success = await recordJobSuccess(repository, claimed!);
      expect(success.status).toBe("completed");
    });
  });

  describe("Administrator DLQ Operations (Inspect, Retry, Abandon)", () => {
    it("allows administrator to inspect, retry, and re-enqueue a dead-lettered job", async () => {
      const repository = new MemoryApiRepository();
      const { job } = await enqueueDurableJob(repository, {
        type: "postage",
        idempotencyKey: "postage-dlq-admin-test",
        payload: { messageId: testMessageId, amount: "100" },
        maxAttempts: 1,
      });

      const { deadLetter } = await recordJobFailure(repository, job, new Error("Contract revert"));
      expect(deadLetter).toBeDefined();

      // Admin inspects DLQ
      const dlqList = await listDeadLetters(repository, { jobType: "postage" });
      expect(dlqList).toHaveLength(1);

      const inspected = await getDeadLetter(repository, deadLetter!.deadLetterId);
      expect(inspected.deadLetterId).toBe(deadLetter!.deadLetterId);

      // Admin retries DLQ
      const retryResult = await retryDeadLetter(repository, deadLetter!.deadLetterId);
      expect(retryResult.deadLetter.status).toBe("retried");
      expect(retryResult.deadLetter.retriedAt).toBeDefined();
      expect(retryResult.job.status).toBe("pending");
      expect(retryResult.job.attempts).toBe(0);

      // Claim again
      const claimed = await repository.claimNextPendingJob(["postage"]);
      expect(claimed).not.toBeNull();
      expect(claimed?.jobId).toBe(job.jobId);
    });

    it("allows administrator to abandon a dead-lettered job with notes", async () => {
      const repository = new MemoryApiRepository();
      const { job } = await enqueueDurableJob(repository, {
        type: "cleanup",
        idempotencyKey: "cleanup-abandon-test",
        payload: { scope: "all" },
        maxAttempts: 1,
      });

      const { deadLetter } = await recordJobFailure(repository, job, new Error("Permanent fatal"));
      expect(deadLetter).toBeDefined();

      const abandoned = await abandonDeadLetter(
        repository,
        deadLetter!.deadLetterId,
        "Confirmed invalid test request by admin",
      );

      expect(abandoned.status).toBe("abandoned");
      expect(abandoned.adminNotes).toBe("Confirmed invalid test request by admin");
      expect(abandoned.abandonedAt).toBeDefined();

      const fetchedJob = await repository.getJob(job.jobId);
      expect(fetchedJob?.status).toBe("abandoned");
    });
  });

  describe("Worker Restart Safety & Idempotent Side Effects", () => {
    it("ensures a worker restart / crash after side effect does not duplicate side effects", async () => {
      const repository = new MemoryApiRepository();
      let sideEffectCounter = 0;

      const scope = {
        actor: testSender,
        method: "POST",
        route: "POST /api/v1/funding",
        rawKey: "funding-idemp-key-100",
      };

      const doMoneyMove = async () => {
        sideEffectCounter++;
        return { status: 200, body: { balance: 500 } };
      };

      // Execution 1: First attempt executes operation
      const first = await withIdempotency(repository, scope, { amount: 100 }, doMoneyMove);
      expect(first.replayed).toBe(false);
      expect(first.body).toEqual({ balance: 500 });
      expect(sideEffectCounter).toBe(1);

      // Simulated worker crash & restart: retry of the exact same operation with same idempotency key
      const restartAttempt = await withIdempotency(repository, scope, { amount: 100 }, doMoneyMove);
      expect(restartAttempt.replayed).toBe(true);
      expect(restartAttempt.body).toEqual({ balance: 500 });
      expect(sideEffectCounter).toBe(1); // Crucial: Side effect was NOT duplicated!
    });
  });

  describe("Receipt Event Indexing with Durable Checkpoints & Gap Detection", () => {
    it("indexes receipt events sequentially, suppresses duplicates, and detects gaps", async () => {
      const repository = new MemoryApiRepository();
      const streamId = "receipts-stream-alpha";

      const batch1: ReceiptEvent[] = [
        {
          eventId: "ev-0",
          streamId,
          sequence: 0,
          messageId: "1".repeat(64),
          recipient: testRecipient,
          sender: testSender,
          deliveredAt: new Date().toISOString(),
        },
        {
          eventId: "ev-1",
          streamId,
          sequence: 1,
          messageId: "2".repeat(64),
          recipient: testRecipient,
          sender: testSender,
          deliveredAt: new Date().toISOString(),
        },
      ];

      const res1 = await indexReceiptEvents(repository, streamId, batch1);
      expect(res1.indexedCount).toBe(2);
      expect(res1.duplicateCount).toBe(0);
      expect(res1.gapsDetected).toBe(0);
      expect(res1.checkpoint.lastSequence).toBe(1);
      expect(res1.checkpoint.processedCount).toBe(2);

      // Re-indexing batch1 (duplicate delivery) -> duplicates suppressed
      const res2 = await indexReceiptEvents(repository, streamId, batch1);
      expect(res2.indexedCount).toBe(0);
      expect(res2.duplicateCount).toBe(2);
      expect(res2.checkpoint.lastSequence).toBe(1);

      // Ingesting batch3 with a sequence gap (skipping sequence 2, 3 and receiving sequence 4)
      const batch3: ReceiptEvent[] = [
        {
          eventId: "ev-4",
          streamId,
          sequence: 4,
          messageId: "4".repeat(64),
          recipient: testRecipient,
          sender: testSender,
          deliveredAt: new Date().toISOString(),
        },
      ];

      const res3 = await indexReceiptEvents(repository, streamId, batch3);
      expect(res3.indexedCount).toBe(1);
      expect(res3.gapsDetected).toBe(2); // Sequences 2 and 3 were skipped
      expect(res3.checkpoint.lastSequence).toBe(4);
      expect(res3.checkpoint.gapCount).toBe(2);
    });
  });
});
