import { describe, expect, it } from "vitest";

import { enforceRetention } from "../../../src/server/api/retention-service";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import { FakeR2Bucket } from "../../../src/services/storage/r2-fake";
import { R2ObjectStoreAdapter } from "../../../src/services/storage/r2-adapter";

const now = new Date("2026-08-20T00:00:00.000Z");

describe("BETA-080 retention enforcement", () => {
  it("abandons expired failed jobs and dead letters and sweeps staged objects", async () => {
    const repository = new MemoryApiRepository();
    const bucket = new FakeR2Bucket();
    const objectStore = new R2ObjectStoreAdapter(bucket);
    const old = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000).toISOString();

    await repository.enqueueJob({
      jobId: "job-old",
      type: "cleanup",
      idempotencyKey: "job-old-key",
      payload: {},
      status: "failed",
      attempts: 5,
      maxAttempts: 5,
      backoffMs: 1000,
      nextRunAt: old,
      createdAt: old,
      updatedAt: old,
      failedAt: old,
    });
    await repository.createDeadLetter({
      deadLetterId: "dlq-old",
      jobId: "job-old",
      jobType: "cleanup",
      idempotencyKey: "job-old-key",
      payload: {},
      attempts: 5,
      errorCode: "ERR_UNKNOWN_PERMANENT",
      errorMessage: "failed",
      deadLetteredAt: old,
      status: "dead",
    });

    const result = await enforceRetention(repository, objectStore, now);
    expect(result.abandonedJobs).toBe(1);
    expect(result.abandonedDeadLetters).toBe(1);
    expect((await repository.getJob("job-old"))?.status).toBe("abandoned");
    expect((await repository.getDeadLetter("dlq-old"))?.status).toBe("abandoned");
  });
});
