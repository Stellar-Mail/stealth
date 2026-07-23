import { describe, expect, it, vi } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  hashIdempotencyKey,
  acquireIdempotency,
  recordIdempotency,
  computeCanonicalDigest,
  executeIdempotentRequest,
} from "../../../src/server/api/idempotency-service";
import { ApiError } from "../../../src/server/api/errors";

const actor1 = `G${"A".repeat(55)}`;
const actor2 = `G${"B".repeat(55)}`;
const rawKey = "test-idempotency-key-123";
const method = "POST";
const route = "/api/v1/postage/settle";

describe("Idempotency Service", () => {
  describe("Legacy & Core Hashing", () => {
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

    it("acquires lease and blocks concurrent followers", async () => {
      const repository = new MemoryApiRepository();

      const acquire1 = await acquireIdempotency(repository, actor1, rawKey);
      expect(acquire1.status).toBe("acquired");

      const acquire2 = await acquireIdempotency(repository, actor1, rawKey);
      expect(acquire2.status).toBe("in_progress");

      const acquireOther = await acquireIdempotency(repository, actor2, rawKey);
      expect(acquireOther.status).toBe("acquired");
    });

    it("returns cached response after completion", async () => {
      const repository = new MemoryApiRepository();

      await acquireIdempotency(repository, actor1, rawKey);
      const responseBody = { success: true, test: "data" };
      await recordIdempotency(repository, actor1, rawKey, 201, responseBody);

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

      const acquire1 = await acquireIdempotency(repository, actor1, rawKey, -100);
      expect(acquire1.status).toBe("acquired");

      const acquire2 = await acquireIdempotency(repository, actor1, rawKey, 30000);
      expect(acquire2.status).toBe("acquired");
    });
  });

  describe("Canonical Request Digest", () => {
    it("canonical digest is deterministic", () => {
      const body = { amount: "100", recipient: actor2 };
      const d1 = computeCanonicalDigest(method, route, body);
      const d2 = computeCanonicalDigest(method, route, body);

      expect(d1).toMatch(/^[a-f0-9]{64}$/);
      expect(d1).toBe(d2);
    });

    it("equivalent JSON payloads produce identical digests", () => {
      const payloadA = { z: 1, a: 2, arr: [10, 20] };
      const payloadB = { a: 2, z: 1, arr: [10, 20] };

      const d1 = computeCanonicalDigest(method, route, payloadA);
      const d2 = computeCanonicalDigest(method, route, payloadB);
      expect(d1).toBe(d2);
    });

    it("different payloads produce different digests", () => {
      const payloadA = { amount: "100" };
      const payloadB = { amount: "200" };

      const d1 = computeCanonicalDigest(method, route, payloadA);
      const d2 = computeCanonicalDigest(method, route, payloadB);
      expect(d1).not.toBe(d2);
    });
  });

  describe("executeIdempotentRequest Workflow", () => {
    it("first request executes normally", async () => {
      const repository = new MemoryApiRepository();
      const body = { messageId: "msg-001" };
      const handlerSpy = vi
        .fn()
        .mockResolvedValue({ status: 201, body: { id: "msg-001", settled: true } });

      const result = await executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: handlerSpy,
      });

      expect(result.isReplay).toBe(false);
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ id: "msg-001", settled: true });
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it("identical request replays stored response", async () => {
      const repository = new MemoryApiRepository();
      const body = { messageId: "msg-001" };
      const handlerSpy = vi
        .fn()
        .mockResolvedValue({ status: 201, body: { id: "msg-001", settled: true } });

      // First request
      await executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: handlerSpy,
      });

      // Second identical request
      const replay = await executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body: { messageId: "msg-001" }, // Equivalent body
        handler: handlerSpy,
      });

      expect(replay.isReplay).toBe(true);
      expect(replay.status).toBe(201);
      expect(replay.body).toEqual({ id: "msg-001", settled: true });
      expect(handlerSpy).toHaveBeenCalledTimes(1); // Handler NOT called second time
    });

    it("same key with different payload returns 409 Conflict", async () => {
      const repository = new MemoryApiRepository();
      const handlerSpy = vi.fn().mockResolvedValue({ status: 200, body: { success: true } });

      // First request
      await executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body: { amount: "100" },
        handler: handlerSpy,
      });

      // Second request with SAME key but DIFFERENT body payload
      await expect(
        executeIdempotentRequest({
          repository,
          actor: actor1,
          method,
          route,
          key: rawKey,
          body: { amount: "9999" }, // Different payload
          handler: handlerSpy,
        }),
      ).rejects.toThrow(ApiError);

      try {
        await executeIdempotentRequest({
          repository,
          actor: actor1,
          method,
          route,
          key: rawKey,
          body: { amount: "9999" },
          handler: handlerSpy,
        });
      } catch (err: any) {
        expect(err.status).toBe(409);
        expect(err.code).toBe("IDEMPOTENCY_KEY_REUSED");
      }
    });

    it("concurrent duplicate requests execute exactly once", async () => {
      const repository = new MemoryApiRepository();
      const body = { messageId: "concurrent-msg" };

      let resolveHandler: (val: any) => void;
      const delayedPromise = new Promise<{ status: number; body: any }>((res) => {
        resolveHandler = res;
      });

      const handlerSpy = vi.fn().mockImplementation(() => delayedPromise);

      // Launch leader request
      const req1Promise = executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: handlerSpy,
      });

      // Launch follower request concurrently
      const req2Promise = executeIdempotentRequest({
        repository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: handlerSpy,
      });

      // Resolve delayed handler
      resolveHandler!({ status: 200, body: { result: "done" } });

      const [res1, res2] = await Promise.all([req1Promise, req2Promise]);

      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.body).toEqual({ result: "done" });
      expect(res2.body).toEqual({ result: "done" });
      expect(res1.isReplay || res2.isReplay).toBe(true);
    });

    it("multiple API contexts share persisted state and survive service restart", async () => {
      const sharedRepository = new MemoryApiRepository();
      const body = { action: "settle", id: "123" };

      // Instance / Context A executes request
      await executeIdempotentRequest({
        repository: sharedRepository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: async () => ({ status: 200, body: { settled: true } }),
      });

      // Simulated Service Restart: new API Context using the persisted repository instance
      const restartContextHandlerSpy = vi.fn().mockResolvedValue({ status: 500, body: "error" });

      const resultPostRestart = await executeIdempotentRequest({
        repository: sharedRepository,
        actor: actor1,
        method,
        route,
        key: rawKey,
        body,
        handler: restartContextHandlerSpy,
      });

      expect(resultPostRestart.isReplay).toBe(true);
      expect(resultPostRestart.status).toBe(200);
      expect(resultPostRestart.body).toEqual({ settled: true });
      expect(restartContextHandlerSpy).not.toHaveBeenCalled();
    });
  });
});
