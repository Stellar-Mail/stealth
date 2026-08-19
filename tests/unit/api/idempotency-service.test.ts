import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  hashIdempotencyKey,
  computeRequestDigest,
  acquireIdempotency,
  recordIdempotency,
  withIdempotency,
  type IdempotencyScope,
} from "../../../src/server/api/idempotency-service";
import { ApiError } from "../../../src/server/api/errors";

const actor1 = `G${"A".repeat(55)}`;
const actor2 = `G${"B".repeat(55)}`;
const rawKey = "test-idempotency-key-123";
const method = "POST";
const route = "POST /test-route";

function scope(overrides: Partial<IdempotencyScope> = {}): IdempotencyScope {
  return { actor: actor1, method, route, rawKey, ...overrides };
}

describe("Idempotency Service", () => {
  it("generates deterministic SHA-256 hashes without leaking raw keys", () => {
    const hash = hashIdempotencyKey(actor1, method, route, rawKey);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); // standard sha256 output format
    expect(hash).not.toContain(rawKey);

    // Verify determinism
    const hash2 = hashIdempotencyKey(actor1, method, route, rawKey);
    expect(hash).toBe(hash2);
  });

  it("ensures actor isolation (no collision for same key under different actors)", () => {
    const hashA1 = hashIdempotencyKey(actor1, method, route, rawKey);
    const hashA2 = hashIdempotencyKey(actor2, method, route, rawKey);
    expect(hashA1).not.toBe(hashA2);
  });

  it("scopes the key by method and route (issue #1498)", () => {
    const hashPost = hashIdempotencyKey(actor1, "POST", route, rawKey);
    const hashPut = hashIdempotencyKey(actor1, "PUT", route, rawKey);
    const hashOtherRoute = hashIdempotencyKey(actor1, method, "POST /other-route", rawKey);
    expect(hashPost).not.toBe(hashPut);
    expect(hashPost).not.toBe(hashOtherRoute);
  });

  it("acquires lease and blocks concurrent followers", async () => {
    const repository = new MemoryApiRepository();
    const body = { amount: 1 };

    // First request acquires successfully
    const acquire1 = await acquireIdempotency(repository, scope(), body);
    expect(acquire1.status).toBe("acquired");

    // Second concurrent request with the same payload gets blocked
    const acquire2 = await acquireIdempotency(repository, scope(), body);
    expect(acquire2.status).toBe("in_progress");

    // Different actor can acquire their own
    const acquireOther = await acquireIdempotency(repository, scope({ actor: actor2 }), body);
    expect(acquireOther.status).toBe("acquired");
  });

  it("returns cached response after completion", async () => {
    const repository = new MemoryApiRepository();
    const body = { amount: 1 };

    // Acquire lock
    await acquireIdempotency(repository, scope(), body);

    // Complete it
    const responseBody = { success: true, test: "data" };
    await recordIdempotency(repository, scope(), body, 201, responseBody);

    // Follower sees completed response
    const acquire2 = await acquireIdempotency(repository, scope(), body);
    expect(acquire2.status).toBe("completed");
    if (acquire2.status === "completed") {
      expect(acquire2.record.status).toBe(201);
      expect(acquire2.record.body).toEqual(responseBody);
      expect(acquire2.record.state).toBe("completed");
    }
  });

  it("recovers abandoned leases after expiry", async () => {
    const repository = new MemoryApiRepository();
    const body = { amount: 1 };

    // Acquire lock with a negative lease (expires instantly)
    const acquire1 = await acquireIdempotency(repository, scope(), body, -100);
    expect(acquire1.status).toBe("acquired");

    // Because it expired in the past, a follower should immediately acquire it
    const acquire2 = await acquireIdempotency(repository, scope(), body, 30000);
    expect(acquire2.status).toBe("acquired");
  });

  describe("payload digest binding (issue #1498)", () => {
    it("computes distinct digests for distinct canonical payloads", () => {
      expect(computeRequestDigest({ a: 1 })).not.toBe(computeRequestDigest({ a: 2 }));
      expect(computeRequestDigest({ a: 1, b: 2 })).toBe(computeRequestDigest({ b: 2, a: 1 }));
    });

    it("returns conflict when an in-flight lease is reused with a different payload", async () => {
      const repository = new MemoryApiRepository();
      await acquireIdempotency(repository, scope(), { amount: 1 });

      const result = await acquireIdempotency(repository, scope(), {
        amount: 2,
      });
      expect(result.status).toBe("conflict");
    });

    it("returns conflict when a completed record is reused with a different payload", async () => {
      const repository = new MemoryApiRepository();
      await acquireIdempotency(repository, scope(), { amount: 1 });
      await recordIdempotency(repository, scope(), { amount: 1 }, 200, {
        ok: true,
      });

      const result = await acquireIdempotency(repository, scope(), {
        amount: 2,
      });
      expect(result.status).toBe("conflict");
    });
  });

  describe("withIdempotency", () => {
    it("runs the operation once and replays it for an identical retry", async () => {
      const repository = new MemoryApiRepository();
      let executions = 0;
      const operation = async () => {
        executions += 1;
        return { status: 201, body: { executions } };
      };

      const first = await withIdempotency(repository, scope(), { amount: 1 }, operation);
      expect(first).toEqual({
        status: 201,
        body: { executions: 1 },
        replayed: false,
      });

      const second = await withIdempotency(repository, scope(), { amount: 1 }, operation);
      expect(second).toEqual({
        status: 201,
        body: { executions: 1 },
        replayed: true,
      });
      expect(executions).toBe(1);
    });

    it("throws idempotency_mismatch (409) when the key is reused with a different payload", async () => {
      const repository = new MemoryApiRepository();
      const operation = async () => ({ status: 201, body: { ok: true } });

      await withIdempotency(repository, scope(), { amount: 1 }, operation);

      await expect(
        withIdempotency(repository, scope(), { amount: 2 }, operation),
      ).rejects.toMatchObject({ code: "idempotency_mismatch", status: 409 });
    });

    it("throws request_in_progress (409) for a concurrent identical duplicate", async () => {
      const repository = new MemoryApiRepository();
      let releaseFirst!: () => void;
      const gate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      const operation = async () => {
        await gate;
        return { status: 201, body: { ok: true } };
      };

      const first = withIdempotency(repository, scope(), { amount: 1 }, operation);
      await Promise.resolve(); // let the first call acquire its lease

      await expect(
        withIdempotency(repository, scope(), { amount: 1 }, operation),
      ).rejects.toMatchObject({ code: "request_in_progress", status: 409 });

      releaseFirst();
      await expect(first).resolves.toMatchObject({
        status: 201,
        replayed: false,
      });
    });

    it("caches only the configured error statuses for replay", async () => {
      const repository = new MemoryApiRepository();
      let executions = 0;
      const failing = async () => {
        executions += 1;
        throw new ApiError(409, "conflict", "already settled");
      };

      await expect(
        withIdempotency(repository, scope(), { amount: 1 }, failing, {
          cacheableErrorStatuses: [409],
        }),
      ).rejects.toMatchObject({ status: 409 });

      // Replayed from the cached error without re-running the operation.
      const replay = await withIdempotency(repository, scope(), { amount: 1 }, failing, {
        cacheableErrorStatuses: [409],
      });
      expect(replay.replayed).toBe(true);
      expect(executions).toBe(1);
    });

    it("does not cache statuses outside cacheableErrorStatuses, allowing retry", async () => {
      const repository = new MemoryApiRepository();
      let executions = 0;
      const flaky = async () => {
        executions += 1;
        if (executions === 1) {
          throw new ApiError(500, "internal_error", "transient");
        }
        return { status: 201, body: { ok: true } };
      };

      await expect(
        withIdempotency(repository, scope(), { amount: 1 }, flaky, {
          cacheableErrorStatuses: [409],
        }),
      ).rejects.toMatchObject({ status: 500 });

      const retry = await withIdempotency(repository, scope(), { amount: 1 }, flaky, {
        cacheableErrorStatuses: [409],
      });
      expect(retry).toEqual({
        status: 201,
        body: { ok: true },
        replayed: false,
      });
      expect(executions).toBe(2);
    });

    it("treats different keys as independent operations", async () => {
      const repository = new MemoryApiRepository();
      let executions = 0;
      const operation = async () => {
        executions += 1;
        return { status: 200, body: { executions } };
      };

      await withIdempotency(repository, scope({ rawKey: "key-a" }), { amount: 1 }, operation);
      await withIdempotency(repository, scope({ rawKey: "key-b" }), { amount: 1 }, operation);
      expect(executions).toBe(2);
    });
  });
});
