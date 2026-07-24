import { describe, expect, it } from "vitest";

import { hashIdempotencyKey } from "../../../src/server/api/idempotency-service";

// Issue #1501: canonicalize request bodies before computing idempotency digests.
const actor = "owner-A";

describe("idempotency key canonicalization", () => {
  it("produces the same digest for object-key reordering", () => {
    const a = { b: 1, a: 2, c: 3 };
    const b = { c: 3, a: 2, b: 1 };
    expect(hashIdempotencyKey(actor, a)).toBe(hashIdempotencyKey(actor, b));
  });

  it("keeps array order significant", () => {
    const a = [1, 2, 3];
    const b = [3, 2, 1];
    expect(hashIdempotencyKey(actor, a)).not.toBe(hashIdempotencyKey(actor, b));
  });

  it("keeps numeric vs string distinctions significant", () => {
    expect(hashIdempotencyKey(actor, 1)).not.toBe(hashIdempotencyKey(actor, "1"));
  });

  it("keeps nested structure significant", () => {
    const a = { x: { y: 1 } };
    const b = { x: { y: 2 } };
    expect(hashIdempotencyKey(actor, a)).not.toBe(hashIdempotencyKey(actor, b));
  });

  it("binds the digest to the actor", () => {
    const payload = { b: 1, a: 2 };
    expect(hashIdempotencyKey("owner-A", payload)).not.toBe(hashIdempotencyKey("owner-B", payload));
  });

  it("is deterministic across calls", () => {
    const payload = { z: [1, 2], a: "x", m: { n: true } };
    expect(hashIdempotencyKey(actor, payload)).toBe(hashIdempotencyKey(actor, payload));
  });
});
