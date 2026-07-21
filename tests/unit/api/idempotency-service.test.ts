import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  hashIdempotencyKey,
  acquireIdempotency,
  recordIdempotency,
} from "../../../src/server/api/idempotency-service";

const actor1 = `G${"A".repeat(55)}`;
const actor2 = `G${"B".repeat(55)}`;
const rawKey = "test-idempotency-key-123";

describe("Idempotency Service", () => {
  it("generates deterministic SHA-256 hashes without leaking raw keys", () => {
    const hash = hashIdempotencyKey(actor1, rawKey);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // standard sha256 output format
    expect(hash).not.toContain(rawKey);

    // Verify determinism
    const hash2 = hashIdempotencyKey(actor1, rawKey);
    expect(hash).toBe(hash2);
  });

  it("ensures actor isolation (no collision for same key under different actors)", () => {
    const hashA1 = hashIdempotencyKey(actor1, rawKey);
    const hashA2 = hashIdempotencyKey(actor2, rawKey);
    expect(hashA1).not.toBe(hashA2);
  });

  it("acquires lease and blocks concurrent followers", async () => {
    const repository = new MemoryApiRepository();

    // First request acquires successfully
    const acquire1 = await acquireIdempotency(repository, actor1, rawKey);
    expect(acquire1.status).toBe("acquired");

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
  });
});
