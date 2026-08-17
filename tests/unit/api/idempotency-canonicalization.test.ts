import { describe, expect, it } from "vitest";

import {
  hashIdempotencyKey,
  computeRequestDigest,
} from "../../../src/server/api/idempotency-service";

// Issue #1501: canonicalize request bodies before computing idempotency digests.
const actor = "owner-A";
const method = "POST";
const route = "POST /test-route";

describe("idempotency key canonicalization", () => {
  it("produces the same digest for object-key reordering", () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };
    expect(hashIdempotencyKey(actor, method, route, a)).toBe(
      hashIdempotencyKey(actor, method, route, b),
    );
  });

  it("keeps array order significant", () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    expect(hashIdempotencyKey(actor, method, route, a)).not.toBe(
      hashIdempotencyKey(actor, method, route, b),
    );
  });

  it("keeps numeric vs string distinctions significant", () => {
    expect(hashIdempotencyKey(actor, method, route, 1)).not.toBe(
      hashIdempotencyKey(actor, method, route, "1"),
    );
  });

  it("keeps nested structure significant", () => {
    const a = { x: { y: 1 } };
    const b = { x: { y: 2 } };
    expect(hashIdempotencyKey(actor, method, route, a)).not.toBe(
      hashIdempotencyKey(actor, method, route, b),
    );
  });

  it("binds the digest to the actor", () => {
    const payload = { b: 1, a: 2 };
    expect(hashIdempotencyKey("owner-A", method, route, payload)).not.toBe(
      hashIdempotencyKey("owner-B", method, route, payload),
    );
  });

  it("binds the digest to the method and route (issue #1498)", () => {
    const payload = { b: 1, a: 2 };
    expect(hashIdempotencyKey(actor, "POST", route, payload)).not.toBe(
      hashIdempotencyKey(actor, "PUT", route, payload),
    );
    expect(hashIdempotencyKey(actor, method, "POST /other-route", payload)).not.toBe(
      hashIdempotencyKey(actor, method, route, payload),
    );
  });

  it("is deterministic across calls", () => {
    const payload = { z: [1, 2], a: "x", m: { n: true } };
    expect(hashIdempotencyKey(actor, method, route, payload)).toBe(
      hashIdempotencyKey(actor, method, route, payload),
    );
  });
});

describe("request digest canonicalization", () => {
  it("produces the same digest for object-key reordering", () => {
    expect(computeRequestDigest({ b: 1, a: 2 })).toBe(computeRequestDigest({ a: 2, b: 1 }));
  });

  it("distinguishes genuinely different payloads", () => {
    expect(computeRequestDigest({ amount: "100" })).not.toBe(
      computeRequestDigest({ amount: "200" }),
    );
  });

  it("is deterministic across calls", () => {
    const payload = { z: [1, 2], a: "x" };
    expect(computeRequestDigest(payload)).toBe(computeRequestDigest(payload));
  });
});
