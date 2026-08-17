import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  computeRequestDigest,
  hashIdempotencyKey,
  withIdempotency,
} from "../../../src/server/api/idempotency-service";
import { distinctAddressPairArbitrary } from "./arbitraries";

const NUM_RUNS = 100;
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const ROUTES = [
  "POST /messages",
  "GET /messages/:id",
  "POST /postage",
  "POST /receipts",
  "PUT /policy",
];

const jsonPrimitiveArbitrary = fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null));
const jsonObjectArbitrary = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 8 }),
  jsonPrimitiveArbitrary,
  { maxKeys: 8 },
);

describe("hashIdempotencyKey (property)", () => {
  it("is deterministic and always a 64-char hex sha256 digest", () => {
    fc.assert(
      fc.property(
        distinctAddressPairArbitrary,
        fc.constantFrom(...METHODS),
        fc.constantFrom(...ROUTES),
        fc.string(),
        ([actor], method, route, rawKey) => {
          const first = hashIdempotencyKey(actor, method, route, rawKey);
          const second = hashIdempotencyKey(actor, method, route, rawKey);
          expect(second).toBe(first);
          expect(first).toMatch(/^[a-f0-9]{64}$/);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("changing the actor, method, route, or raw key each change the resulting hash", () => {
    fc.assert(
      fc.property(
        distinctAddressPairArbitrary,
        fc.constantFrom(...METHODS),
        fc.constantFrom(...METHODS),
        fc.constantFrom(...ROUTES),
        fc.constantFrom(...ROUTES),
        fc.string(),
        fc.string(),
        ([actorA, actorB], methodA, methodB, routeA, routeB, keyA, keyB) => {
          fc.pre(methodA !== methodB);
          fc.pre(routeA !== routeB);
          fc.pre(keyA !== keyB);

          const base = hashIdempotencyKey(actorA, methodA, routeA, keyA);
          expect(hashIdempotencyKey(actorB, methodA, routeA, keyA)).not.toBe(base);
          expect(hashIdempotencyKey(actorA, methodB, routeA, keyA)).not.toBe(base);
          expect(hashIdempotencyKey(actorA, methodA, routeB, keyA)).not.toBe(base);
          expect(hashIdempotencyKey(actorA, methodA, routeA, keyB)).not.toBe(base);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("computeRequestDigest (property)", () => {
  it("is independent of an object's key insertion order", () => {
    fc.assert(
      fc.property(jsonObjectArbitrary, (obj) => {
        const reversed = Object.fromEntries([...Object.entries(obj)].reverse());
        expect(computeRequestDigest(reversed)).toBe(computeRequestDigest(obj));
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("withIdempotency (property)", () => {
  it("runs the operation exactly once per key, replaying the identical result thereafter", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        fc.constantFrom(...METHODS),
        fc.constantFrom(...ROUTES),
        fc.string(),
        jsonObjectArbitrary,
        fc.integer({ min: 200, max: 299 }),
        async ([actor], method, route, rawKey, rawBody, status) => {
          const repository = new MemoryApiRepository();
          const scope = { actor, method, route, rawKey };
          let calls = 0;
          const operation = async () => {
            calls += 1;
            return { status, body: { ok: true, calls } };
          };

          const first = await withIdempotency(repository, scope, rawBody, operation);
          const second = await withIdempotency(repository, scope, rawBody, operation);

          expect(calls).toBe(1);
          expect(first.replayed).toBe(false);
          expect(second.replayed).toBe(true);
          expect(second.status).toBe(first.status);
          expect(second.body).toEqual(first.body);
        },
      ),
      { numRuns: 40 },
    );
  });

  it("rejects a replay under the same key with a different payload as idempotency_mismatch", async () => {
    await fc.assert(
      fc.asyncProperty(
        distinctAddressPairArbitrary,
        fc.constantFrom(...METHODS),
        fc.constantFrom(...ROUTES),
        fc.string(),
        jsonObjectArbitrary,
        jsonObjectArbitrary,
        async ([actor], method, route, rawKey, bodyA, bodyB) => {
          fc.pre(computeRequestDigest(bodyA) !== computeRequestDigest(bodyB));
          const repository = new MemoryApiRepository();
          const scope = { actor, method, route, rawKey };

          await withIdempotency(repository, scope, bodyA, async () => ({ status: 200, body: {} }));

          await expect(
            withIdempotency(repository, scope, bodyB, async () => ({ status: 200, body: {} })),
          ).rejects.toMatchObject({ code: "idempotency_mismatch" });
        },
      ),
      { numRuns: 40 },
    );
  });
});
