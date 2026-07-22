import { Keypair } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it } from "vitest";

import {
  AUTH_HEADERS,
  CLOCK_SKEW_MS,
  NONCE_WINDOW_SECONDS,
  buildCanonicalPayload,
  requireVerifiedActor,
  requireVerifiedActorMatches,
  verifySignedRequest,
} from "../../../src/server/api/auth";
import { MemoryApiRepository } from "../../../src/server/api/memory-repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTimestamp(offsetMs = 0, base = new Date()): string {
  return new Date(base.getTime() + offsetMs).toISOString();
}

function makeNonce(): string {
  return Math.random().toString(36).slice(2).padEnd(8, "x");
}

function signRequest(
  keypair: Keypair,
  opts: {
    method?: string;
    path?: string;
    timestamp?: string;
    nonce?: string;
  } = {},
): { timestamp: string; nonce: string; signature: string } {
  const timestamp = opts.timestamp ?? makeTimestamp();
  const nonce = opts.nonce ?? makeNonce();
  const method = opts.method ?? "GET";
  const path = opts.path ?? "/api/v1/test";
  const canonical = buildCanonicalPayload(method, path, timestamp, nonce);
  const sig = keypair.sign(Buffer.from(canonical, "utf8"));
  const signature = Buffer.from(sig).toString("hex");
  return { timestamp, nonce, signature };
}

function makeRequest(
  keypair: Keypair,
  opts: {
    method?: string;
    path?: string;
    timestamp?: string;
    nonce?: string;
    overrideHeaders?: Record<string, string>;
  } = {},
): Request {
  const method = opts.method ?? "GET";
  const path = opts.path ?? "/api/v1/test";
  const { timestamp, nonce, signature } = signRequest(keypair, {
    method,
    path,
    timestamp: opts.timestamp,
    nonce: opts.nonce,
  });

  const headers: Record<string, string> = {
    [AUTH_HEADERS.address]: keypair.publicKey(),
    [AUTH_HEADERS.timestamp]: timestamp,
    [AUTH_HEADERS.nonce]: nonce,
    [AUTH_HEADERS.signature]: signature,
    ...opts.overrideHeaders,
  };

  return new Request(`https://stealth.test${path}`, { method, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("verifySignedRequest", () => {
  let repo: MemoryApiRepository;
  let keypair: Keypair;
  let now: Date;

  beforeEach(() => {
    repo = new MemoryApiRepository();
    keypair = Keypair.random();
    now = new Date("2026-07-20T12:00:00.000Z");
  });

  // -- Happy path --

  it("accepts a well-formed signed request", async () => {
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    const actor = await verifySignedRequest(req, repo, now);
    expect(actor.address).toBe(keypair.publicKey());
  });

  it("returns the verified G-address uppercased", async () => {
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    const actor = await verifySignedRequest(req, repo, now);
    expect(actor.address).toMatch(/^G[A-Z2-7]{55}$/);
  });

  // -- Missing headers --

  it("rejects when x-stealth-address is absent", async () => {
    const req = makeRequest(keypair, {
      timestamp: now.toISOString(),
      overrideHeaders: { [AUTH_HEADERS.address]: "" },
    });
    // rebuilding without address header
    const headers = new Headers(req.headers);
    headers.delete(AUTH_HEADERS.address);
    const bare = new Request(req.url, { method: req.method, headers });
    await expect(verifySignedRequest(bare, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects when x-stealth-signature is absent", async () => {
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    const headers = new Headers(req.headers);
    headers.delete(AUTH_HEADERS.signature);
    const bare = new Request(req.url, { method: req.method, headers });
    await expect(verifySignedRequest(bare, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  // -- Bad address format --

  it("rejects a non-G-address in x-stealth-address", async () => {
    const req = makeRequest(keypair, {
      timestamp: now.toISOString(),
      overrideHeaders: { [AUTH_HEADERS.address]: "not-a-stellar-address" },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  // -- Timestamp expiration --

  it("rejects a timestamp too far in the past", async () => {
    const stale = makeTimestamp(-(CLOCK_SKEW_MS + 1000), now);
    const req = makeRequest(keypair, { timestamp: stale });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("rejects a timestamp too far in the future", async () => {
    const future = makeTimestamp(CLOCK_SKEW_MS + 1000, now);
    const req = makeRequest(keypair, { timestamp: future });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("accepts a timestamp at exactly the clock-skew boundary", async () => {
    const edge = makeTimestamp(-CLOCK_SKEW_MS, now);
    const req = makeRequest(keypair, { timestamp: edge });
    const actor = await verifySignedRequest(req, repo, now);
    expect(actor.address).toBe(keypair.publicKey());
  });

  it("rejects a non-ISO timestamp", async () => {
    const req = makeRequest(keypair, {
      timestamp: now.toISOString(),
      overrideHeaders: { [AUTH_HEADERS.timestamp]: "not-a-date" },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  // -- Nonce validation --

  it("rejects a nonce shorter than 8 characters", async () => {
    const { timestamp, signature } = signRequest(keypair, {
      timestamp: now.toISOString(),
      nonce: "short",
    });
    const req = new Request("https://stealth.test/api/v1/test", {
      headers: {
        [AUTH_HEADERS.address]: keypair.publicKey(),
        [AUTH_HEADERS.timestamp]: timestamp,
        [AUTH_HEADERS.nonce]: "short",
        [AUTH_HEADERS.signature]: signature,
      },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a nonce longer than 128 characters", async () => {
    const longNonce = "x".repeat(129);
    const { timestamp, signature } = signRequest(keypair, {
      timestamp: now.toISOString(),
      nonce: longNonce,
    });
    const req = new Request("https://stealth.test/api/v1/test", {
      headers: {
        [AUTH_HEADERS.address]: keypair.publicKey(),
        [AUTH_HEADERS.timestamp]: timestamp,
        [AUTH_HEADERS.nonce]: longNonce,
        [AUTH_HEADERS.signature]: signature,
      },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  // -- Signature verification --

  it("rejects a signature produced by a different keypair", async () => {
    const other = Keypair.random();
    const { timestamp, nonce } = signRequest(keypair, { timestamp: now.toISOString() });
    // sign with other key but claim keypair's address
    const canonical = buildCanonicalPayload("GET", "/api/v1/test", timestamp, nonce);
    const badSig = Buffer.from(other.sign(Buffer.from(canonical, "utf8"))).toString("hex");

    const req = new Request("https://stealth.test/api/v1/test", {
      headers: {
        [AUTH_HEADERS.address]: keypair.publicKey(),
        [AUTH_HEADERS.timestamp]: timestamp,
        [AUTH_HEADERS.nonce]: nonce,
        [AUTH_HEADERS.signature]: badSig,
      },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a tampered canonical payload (wrong path)", async () => {
    // sign for /api/v1/test but send request to /api/v1/other
    const { timestamp, nonce } = signRequest(keypair, {
      path: "/api/v1/test",
      timestamp: now.toISOString(),
    });
    const canonical = buildCanonicalPayload("GET", "/api/v1/test", timestamp, nonce);
    const sig = Buffer.from(keypair.sign(Buffer.from(canonical, "utf8"))).toString("hex");

    const req = new Request("https://stealth.test/api/v1/other", {
      headers: {
        [AUTH_HEADERS.address]: keypair.publicKey(),
        [AUTH_HEADERS.timestamp]: timestamp,
        [AUTH_HEADERS.nonce]: nonce,
        [AUTH_HEADERS.signature]: sig,
      },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a signature that is not valid hex", async () => {
    const req = makeRequest(keypair, {
      timestamp: now.toISOString(),
      overrideHeaders: { [AUTH_HEADERS.signature]: "zz".repeat(64) },
    });
    await expect(verifySignedRequest(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });

  // -- Replay protection --

  it("rejects a replayed nonce from the same address", async () => {
    const nonce = makeNonce();
    const req1 = makeRequest(keypair, { timestamp: now.toISOString(), nonce });
    await verifySignedRequest(req1, repo, now);

    // second request with same nonce — must be a fresh signed request
    const { signature, timestamp } = signRequest(keypair, {
      timestamp: now.toISOString(),
      nonce,
    });
    const req2 = new Request("https://stealth.test/api/v1/test", {
      headers: {
        [AUTH_HEADERS.address]: keypair.publicKey(),
        [AUTH_HEADERS.timestamp]: timestamp,
        [AUTH_HEADERS.nonce]: nonce,
        [AUTH_HEADERS.signature]: signature,
      },
    });
    await expect(verifySignedRequest(req2, repo, now)).rejects.toMatchObject({
      status: 401,
      code: "unauthorized",
    });
  });

  it("allows same nonce from a different address", async () => {
    const nonce = makeNonce();
    const other = Keypair.random();

    const req1 = makeRequest(keypair, { timestamp: now.toISOString(), nonce });
    await verifySignedRequest(req1, repo, now);

    const req2 = makeRequest(other, { timestamp: now.toISOString(), nonce });
    const actor = await verifySignedRequest(req2, repo, now);
    expect(actor.address).toBe(other.publicKey());
  });

  it("stores only a digest of address:nonce, not the raw values", async () => {
    const nonce = makeNonce();
    const req = makeRequest(keypair, { timestamp: now.toISOString(), nonce });
    await verifySignedRequest(req, repo, now);

    // the raw nonce and address should not appear as idempotency keys
    const rawNonceKey = await repo.getIdempotencyRecord(`auth:nonce:${nonce}`);
    expect(rawNonceKey).toBeNull();
    const rawAddressKey = await repo.getIdempotencyRecord(`auth:nonce:${keypair.publicKey()}`);
    expect(rawAddressKey).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// requireVerifiedActor
// ---------------------------------------------------------------------------

describe("requireVerifiedActor", () => {
  let repo: MemoryApiRepository;
  let keypair: Keypair;
  let now: Date;

  beforeEach(() => {
    repo = new MemoryApiRepository();
    keypair = Keypair.random();
    now = new Date("2026-07-20T12:00:00.000Z");
  });

  it("returns the verified address on success", async () => {
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    const address = await requireVerifiedActor(req, repo, now);
    expect(address).toBe(keypair.publicKey());
  });

  it("throws 401 on invalid signature", async () => {
    const req = makeRequest(keypair, {
      timestamp: now.toISOString(),
      overrideHeaders: { [AUTH_HEADERS.signature]: "aa".repeat(64) },
    });
    await expect(requireVerifiedActor(req, repo, now)).rejects.toMatchObject({ status: 401 });
  });
});

// ---------------------------------------------------------------------------
// requireVerifiedActorMatches
// ---------------------------------------------------------------------------

describe("requireVerifiedActorMatches", () => {
  let repo: MemoryApiRepository;
  let keypair: Keypair;
  let now: Date;

  beforeEach(() => {
    repo = new MemoryApiRepository();
    keypair = Keypair.random();
    now = new Date("2026-07-20T12:00:00.000Z");
  });

  it("returns the address when it matches", async () => {
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    const address = await requireVerifiedActorMatches(req, repo, keypair.publicKey(), now);
    expect(address).toBe(keypair.publicKey());
  });

  it("throws 403 when the verified address does not match", async () => {
    const other = Keypair.random();
    const req = makeRequest(keypair, { timestamp: now.toISOString() });
    await expect(
      requireVerifiedActorMatches(req, repo, other.publicKey(), now),
    ).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalPayload
// ---------------------------------------------------------------------------

describe("buildCanonicalPayload", () => {
  it("produces a deterministic string", () => {
    const p1 = buildCanonicalPayload("POST", "/api/v1/receipts", "2026-07-20T12:00:00.000Z", "abc12345");
    const p2 = buildCanonicalPayload("POST", "/api/v1/receipts", "2026-07-20T12:00:00.000Z", "abc12345");
    expect(p1).toBe(p2);
  });

  it("includes the domain prefix", () => {
    const p = buildCanonicalPayload("GET", "/api", "2026-07-20T12:00:00.000Z", "nonce123");
    expect(p).toMatch(/^stealth-auth:v1:/);
  });

  it("uppercases the method", () => {
    const p = buildCanonicalPayload("post", "/api", "2026-07-20T12:00:00.000Z", "nonce123");
    expect(p).toContain(":POST:");
  });

  it("changes with every field", () => {
    const base = buildCanonicalPayload("GET", "/api", "2026-07-20T12:00:00.000Z", "nonce123");
    expect(buildCanonicalPayload("POST", "/api", "2026-07-20T12:00:00.000Z", "nonce123")).not.toBe(base);
    expect(buildCanonicalPayload("GET", "/other", "2026-07-20T12:00:00.000Z", "nonce123")).not.toBe(base);
    expect(buildCanonicalPayload("GET", "/api", "2026-07-20T12:00:01.000Z", "nonce123")).not.toBe(base);
    expect(buildCanonicalPayload("GET", "/api", "2026-07-20T12:00:00.000Z", "nonce124")).not.toBe(base);
  });

  it("does not include NONCE_WINDOW_SECONDS in the export to confirm it is exported", () => {
    // just assert the constant is a positive integer
    expect(NONCE_WINDOW_SECONDS).toBeGreaterThan(0);
    expect(Number.isInteger(NONCE_WINDOW_SECONDS)).toBe(true);
  });
});
