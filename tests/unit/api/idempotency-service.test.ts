import { describe, expect, it } from "vitest";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  hashIdempotencyKey,
  checkIdempotency,
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

  it("checks and records idempotency records properly in repository", async () => {
    const repository = new MemoryApiRepository();

    // initially empty
    const check1 = await checkIdempotency(repository, actor1, rawKey);
    expect(check1).toBeNull();

    const responseBody = { success: true, test: "data" };
    await recordIdempotency(repository, actor1, rawKey, 201, responseBody);

    // check after recording
    const check2 = await checkIdempotency(repository, actor1, rawKey);
    expect(check2).not.toBeNull();
    expect(check2?.status).toBe(201);
    expect(check2?.body).toEqual(responseBody);
    expect(check2?.createdAt).toBeDefined();

    // check other actor does not see the same key
    const checkOther = await checkIdempotency(repository, actor2, rawKey);
    expect(checkOther).toBeNull();
  });
});
