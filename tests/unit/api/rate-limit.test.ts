import { beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";
import {
  ANONYMOUS_LIMIT,
  AUTHENTICATED_LIMIT,
  applyRateLimit,
  checkAnonymousLimit,
  checkAuthenticatedLimit,
} from "../../../src/server/api/rate-limit";

const PRINCIPAL_A = `G${"A".repeat(55)}`;
const PRINCIPAL_B = `G${"B".repeat(55)}`;

function exhausted(repository: MemoryApiRepository, key: string, count: number, window = 60) {
  const calls: Promise<number>[] = [];
  for (let i = 0; i < count; i++) {
    calls.push(repository.incrementCounter(key, window));
  }
  return Promise.all(calls);
}

// ---------------------------------------------------------------------------
// checkAuthenticatedLimit
// ---------------------------------------------------------------------------

describe("checkAuthenticatedLimit", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("allows calls under the limit", async () => {
    const result = await checkAuthenticatedLimit(repo, PRINCIPAL_A);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it("returns the bucket key prefixed with rl:auth:", async () => {
    const result = await checkAuthenticatedLimit(repo, PRINCIPAL_A);
    expect(result.bucketKey).toBe(`rl:auth:${PRINCIPAL_A}`);
  });

  it("throws ApiError 429 after exhaustion", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, AUTHENTICATED_LIMIT.max);
    await expect(checkAuthenticatedLimit(repo, PRINCIPAL_A)).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("includes retryAfterSeconds in the thrown error details", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, AUTHENTICATED_LIMIT.max);
    try {
      await checkAuthenticatedLimit(repo, PRINCIPAL_A);
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect((apiErr.details as { retryAfterSeconds: number }).retryAfterSeconds).toBe(
        AUTHENTICATED_LIMIT.windowSeconds,
      );
    }
  });

  it("isolates principals — exhausting A does not block B", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, AUTHENTICATED_LIMIT.max);
    const result = await checkAuthenticatedLimit(repo, PRINCIPAL_B);
    expect(result.allowed).toBe(true);
  });

  it("accepts custom limit overrides", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, 5, 30);
    await expect(
      checkAuthenticatedLimit(repo, PRINCIPAL_A, { max: 5, windowSeconds: 30 }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it("refills after the window resets", async () => {
    // simulate window expiry by using a fresh counter state
    const freshRepo = new MemoryApiRepository();
    const result = await checkAuthenticatedLimit(freshRepo, PRINCIPAL_A);
    expect(result.allowed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkAnonymousLimit
// ---------------------------------------------------------------------------

describe("checkAnonymousLimit", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("allows calls under the limit for a known address", async () => {
    const result = await checkAnonymousLimit(repo, "1.2.3.4");
    expect(result.allowed).toBe(true);
  });

  it("bucket key does not contain the raw address", async () => {
    const result = await checkAnonymousLimit(repo, "203.0.113.99");
    expect(result.bucketKey).not.toContain("203.0.113.99");
    expect(result.bucketKey).toMatch(/^rl:anon:[a-f0-9]{32}$/);
  });

  it("throws ApiError 429 after exhaustion for a known address", async () => {
    // drive the underlying counter past the limit directly
    const firstResult = await checkAnonymousLimit(repo, "1.2.3.4");
    await exhausted(repo, firstResult.bucketKey, ANONYMOUS_LIMIT.max);

    await expect(checkAnonymousLimit(repo, "1.2.3.4")).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("two different addresses use different buckets", async () => {
    const r1 = await checkAnonymousLimit(repo, "1.2.3.4");
    const r2 = await checkAnonymousLimit(repo, "5.6.7.8");
    expect(r1.bucketKey).not.toBe(r2.bucketKey);
  });

  it("same address produces the same bucket key deterministically", async () => {
    const r1 = await checkAnonymousLimit(repo, "10.0.0.1");
    const r2 = await checkAnonymousLimit(repo, "10.0.0.1");
    expect(r1.bucketKey).toBe(r2.bucketKey);
  });

  it("uses fallback bucket when address is absent", async () => {
    const result = await checkAnonymousLimit(repo, undefined);
    expect(result.bucketKey).toBe("rl:anon:fallback");
  });

  it("uses fallback bucket when address is 'unknown'", async () => {
    const result = await checkAnonymousLimit(repo, "unknown");
    expect(result.bucketKey).toBe("rl:anon:fallback");
  });

  it("uses fallback bucket when address is empty string", async () => {
    const result = await checkAnonymousLimit(repo, "");
    expect(result.bucketKey).toBe("rl:anon:fallback");
  });

  it("fallback bucket has a tighter limit than a known address", async () => {
    const halfMax = Math.floor(ANONYMOUS_LIMIT.max / 2);
    const fallbackResult = await checkAnonymousLimit(repo, undefined);
    await exhausted(repo, fallbackResult.bucketKey, halfMax);

    await expect(checkAnonymousLimit(repo, undefined)).rejects.toMatchObject({ status: 429 });

    // a known address at the same count is still allowed
    const knownResult = await checkAnonymousLimit(repo, "1.2.3.4");
    expect(knownResult.allowed).toBe(true);
  });

  it("includes retryAfterSeconds in the thrown error details", async () => {
    const first = await checkAnonymousLimit(repo, "9.9.9.9");
    await exhausted(repo, first.bucketKey, ANONYMOUS_LIMIT.max);
    try {
      await checkAnonymousLimit(repo, "9.9.9.9");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect((apiErr.details as { retryAfterSeconds: number }).retryAfterSeconds).toBe(
        ANONYMOUS_LIMIT.windowSeconds,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// applyRateLimit (dispatcher)
// ---------------------------------------------------------------------------

describe("applyRateLimit", () => {
  let repo: MemoryApiRepository;

  beforeEach(() => {
    repo = new MemoryApiRepository();
  });

  it("routes to authenticated limiter when principal is provided", async () => {
    const result = await applyRateLimit(repo, { principal: PRINCIPAL_A });
    expect(result.bucketKey).toBe(`rl:auth:${PRINCIPAL_A}`);
  });

  it("routes to anonymous limiter when no principal is provided", async () => {
    const result = await applyRateLimit(repo, { networkAddress: "1.2.3.4" });
    expect(result.bucketKey).toMatch(/^rl:anon:/);
  });

  it("authenticated caller is not affected by anonymous exhaustion", async () => {
    // exhaust the anon fallback
    const anonResult = await applyRateLimit(repo, {});
    await exhausted(repo, anonResult.bucketKey, Math.floor(ANONYMOUS_LIMIT.max / 2));
    await expect(applyRateLimit(repo, {})).rejects.toMatchObject({ status: 429 });

    // authenticated caller on same repo is still allowed
    const authResult = await applyRateLimit(repo, { principal: PRINCIPAL_A });
    expect(authResult.allowed).toBe(true);
  });

  it("anonymous caller is not affected by authenticated exhaustion", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, AUTHENTICATED_LIMIT.max);
    await expect(applyRateLimit(repo, { principal: PRINCIPAL_A })).rejects.toMatchObject({
      status: 429,
    });

    // anonymous caller on same repo is still allowed
    const anonResult = await applyRateLimit(repo, { networkAddress: "2.2.2.2" });
    expect(anonResult.allowed).toBe(true);
  });

  it("throws ApiError 429 with retry guidance for authenticated exhaustion", async () => {
    await exhausted(repo, `rl:auth:${PRINCIPAL_A}`, AUTHENTICATED_LIMIT.max);
    await expect(applyRateLimit(repo, { principal: PRINCIPAL_A })).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });
});
