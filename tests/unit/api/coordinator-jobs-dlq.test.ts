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

import { StealthCoordinator } from "@/server/api/stealth-coordinator";
import type { DeadLetter, DurableJob, ReceiptCheckpoint } from "@/server/api/domain";

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
    async list(options?: { prefix?: string }) {
      const result = new Map<string, any>();
      const prefix = options?.prefix ?? "";
      for (const [k, v] of this.store.entries()) {
        if (k.startsWith(prefix)) {
          result.set(k, v);
        }
      }
      return result;
    },
  };
}

describe("StealthCoordinator - Durable Jobs & DLQ Operations", () => {
  let state: MockDurableObjectState;
  let coordinator: StealthCoordinator;

  beforeEach(() => {
    state = new MockDurableObjectState();
    coordinator = new StealthCoordinator(state as any, {});
  });

  it("handles durable job enqueue, deduplication, and update", async () => {
    const job: DurableJob = {
      jobId: "job-100",
      type: "funding",
      idempotencyKey: "idemp-key-100",
      payload: { amount: 100 },
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      backoffMs: 1000,
      nextRunAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const first = await coordinator.enqueueJob(job);
    expect(first.enqueued).toBe(true);

    const second = await coordinator.enqueueJob(job);
    expect(second.enqueued).toBe(false);
    expect(second.job.jobId).toBe("job-100");

    const fetched = await coordinator.getJob("job-100");
    expect(fetched?.jobId).toBe("job-100");

    const fetchedByIdemp = await coordinator.getJobByIdempotencyKey("idemp-key-100");
    expect(fetchedByIdemp?.jobId).toBe("job-100");

    const updated = await coordinator.updateJob({ ...job, status: "completed" });
    expect(updated.status).toBe("completed");
  });

  it("handles claiming pending jobs and listing with filters", async () => {
    const job1: DurableJob = {
      jobId: "job-1",
      type: "delivery",
      idempotencyKey: "idemp-1",
      payload: {},
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      backoffMs: 1000,
      nextRunAt: new Date(Date.now() - 10000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const job2: DurableJob = {
      jobId: "job-2",
      type: "anchoring",
      idempotencyKey: "idemp-2",
      payload: {},
      status: "pending",
      attempts: 0,
      maxAttempts: 5,
      backoffMs: 1000,
      nextRunAt: new Date(Date.now() + 60000).toISOString(), // future
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await coordinator.enqueueJob(job1);
    await coordinator.enqueueJob(job2);

    const claimed = await coordinator.claimNextPendingJob(["delivery"]);
    expect(claimed?.jobId).toBe("job-1");
    expect(claimed?.status).toBe("running");

    const listAll = await coordinator.listJobs();
    expect(listAll).toHaveLength(2);
  });

  it("handles dead-letter persistence and listing", async () => {
    const dlq: DeadLetter = {
      deadLetterId: "dlq-1",
      jobId: "job-1",
      jobType: "delivery",
      idempotencyKey: "idemp-1",
      payload: {},
      attempts: 5,
      errorCode: "ERR_RPC_TIMEOUT",
      errorMessage: "Connection timed out",
      deadLetteredAt: new Date().toISOString(),
      status: "dead",
    };

    await coordinator.createDeadLetter(dlq);
    const fetched = await coordinator.getDeadLetter("dlq-1");
    expect(fetched?.deadLetterId).toBe("dlq-1");

    const list = await coordinator.listDeadLetters();
    expect(list).toHaveLength(1);

    const updated = await coordinator.updateDeadLetter({ ...dlq, status: "retried" });
    expect(updated.status).toBe("retried");
  });

  it("handles receipt checkpoints", async () => {
    const cp: ReceiptCheckpoint = {
      streamId: "stream-1",
      lastSequence: 10,
      processedCount: 11,
      lastIndexedAt: new Date().toISOString(),
      gapCount: 0,
    };

    expect(await coordinator.getReceiptCheckpoint("stream-1")).toBeNull();
    await coordinator.setReceiptCheckpoint(cp);

    const fetched = await coordinator.getReceiptCheckpoint("stream-1");
    expect(fetched?.lastSequence).toBe(10);
    expect(fetched?.processedCount).toBe(11);
  });
});
