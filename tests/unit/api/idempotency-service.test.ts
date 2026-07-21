import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  hashIdempotencyKey,
  acquireIdempotency,
  recordIdempotency,
  cleanupExpiredIdempotencyRecords,
  getIdempotencyTtlSeconds,
} from "../../../src/server/api/idempotency-service";

const actor1 = `G${"A".repeat(55)}`;
const actor2 = `G${"B".repeat(55)}`;
const rawKey = "test-idempotency-key-123";

describe("Idempotency Service", () => {
  it("generates deterministic SHA-256 hashes without leaking raw keys", () => {
    const hash = hashIdempotencyKey(actor1, rawKey);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(rawKey);

    const hash2 = hashIdempotencyKey(actor1, rawKey);
    expect(hash).toBe(hash2);
  });

  it("ensures actor isolation (no collision for same key under different actors)", () => {
    const hashA1 = hashIdempotencyKey(actor1, rawKey);
    const hashA2 = hashIdempotencyKey(actor2, rawKey);
    expect(hashA1).not.toBe(hashA2);
  });

<<<<<<< HEAD
  it("checks and records idempotency records properly in repository with expiresAt", async () => {
    const repository = new MemoryApiRepository();

    const check1 = await checkIdempotency(repository, actor1, rawKey);
    expect(check1).toBeNull();
=======
  it("acquires lease and blocks concurrent followers", async () => {
    const repository = new MemoryApiRepository();

    // First request acquires successfully
    const acquire1 = await acquireIdempotency(repository, actor1, rawKey);
    expect(acquire1.status).toBe("acquired");
>>>>>>> upstream/main

    // Second concurrent request gets blocked
    const acquire2 = await acquireIdempotency(repository, actor1, rawKey);
    expect(acquire2.status).toBe("in_progress");

    // Different actor can acquire their own
    const acquireOther = await acquireIdempotency(repository, actor2, rawKey);
    expect(acquireOther.status).toBe("acquired");
  });

  it("returns cached response after completion", async () => {
    const repository = new MemoryApiRepository();

    // Acquire lock
    await acquireIdempotency(repository, actor1, rawKey);

    // Complete it
    const responseBody = { success: true, test: "data" };
    await recordIdempotency(repository, actor1, rawKey, 201, responseBody);

<<<<<<< HEAD
    const check2 = await checkIdempotency(repository, actor1, rawKey);
    expect(check2).not.toBeNull();
    expect(check2?.status).toBe(201);
    expect(check2?.body).toEqual(responseBody);
    expect(check2?.createdAt).toBeDefined();
    expect(check2?.expiresAt).toBeDefined();

    const checkOther = await checkIdempotency(repository, actor2, rawKey);
    expect(checkOther).toBeNull();
=======
    // Follower sees completed response
    const acquire2 = await acquireIdempotency(repository, actor1, rawKey);
    expect(acquire2.status).toBe("completed");
    if (acquire2.status === "completed") {
      expect(acquire2.record.status).toBe(201);
      expect(acquire2.record.body).toEqual(responseBody);
      expect(acquire2.record.state).toBe("completed");
    }
  });

  it("recovers abandoned leases after expiry", async () => {
    const repository = new MemoryApiRepository();

    // Acquire lock with 0ms lease (expires instantly)
    const acquire1 = await acquireIdempotency(repository, actor1, rawKey, -100);
    expect(acquire1.status).toBe("acquired");

    // Because it expired in the past, a follower should immediately acquire it
    const acquire2 = await acquireIdempotency(repository, actor1, rawKey, 30000);
    expect(acquire2.status).toBe("acquired");
>>>>>>> upstream/main
  });

  it("respects TTL configuration and environment defaults", () => {
    expect(getIdempotencyTtlSeconds({ ttlSeconds: 3600 })).toBe(3600);

    process.env.IDEMPOTENCY_TTL_SECONDS = "7200";
    expect(getIdempotencyTtlSeconds()).toBe(7200);
    delete process.env.IDEMPOTENCY_TTL_SECONDS;

    expect(getIdempotencyTtlSeconds()).toBe(86400); // default
  });

  it("purges expired completed records while retaining valid ones", async () => {
    const repository = new MemoryApiRepository();

    // Record with 1 hour TTL
    await recordIdempotency(repository, actor1, "key-old", 200, { ok: true }, { ttlSeconds: 3600 });
    await recordIdempotency(
      repository,
      actor1,
      "key-fresh",
      200,
      { ok: true },
      { ttlSeconds: 86400 },
    );

    // Fast forward 2 hours
    const futureTime = new Date(Date.now() + 7200 * 1000).toISOString();
    const metrics = await cleanupExpiredIdempotencyRecords(repository, futureTime);

    expect(metrics.purgedCount).toBe(1);

    const checkOld = await checkIdempotency(repository, actor1, "key-old");
    expect(checkOld).toBeNull();

    const checkFresh = await checkIdempotency(repository, actor1, "key-fresh");
    expect(checkFresh).not.toBeNull();
  });

  it("NEVER purges active/PENDING records during cleanup", async () => {
    const repository = new MemoryApiRepository();
    const keyHash = hashIdempotencyKey(actor1, "active-op");

    // Record an active operation (status = 0) with past expiresAt
    await repository.setIdempotencyRecord(keyHash, {
      status: 0,
      body: null,
      createdAt: new Date(Date.now() - 100000).toISOString(),
      expiresAt: new Date(Date.now() - 50000).toISOString(),
    });

    const metrics = await cleanupExpiredIdempotencyRecords(repository, new Date().toISOString());

    expect(metrics.purgedCount).toBe(0);
    expect(metrics.activeSkippedCount).toBe(1);

    const activeCheck = await checkIdempotency(repository, actor1, "active-op");
    expect(activeCheck).not.toBeNull();
  });
});
