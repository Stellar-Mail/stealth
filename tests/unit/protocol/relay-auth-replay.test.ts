import { describe, expect, it, beforeEach } from "vitest";

import { genKeypair, signPayload } from "../../../src/services/crypto/signer";
import {
  type SignedEnvelope,
  type SignedPayload,
  type RelayAuthConfig,
  MemoryNonceStore,
  MemoryIdempotencyStore,
  validateSignedRequest,
  validateTimestamp,
  checkNonceReplay,
  checkIdempotency,
  validateAudience,
} from "../../../src/server/api/relay-auth";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config: RelayAuthConfig = {
  replayWindowMs: 2 * 60 * 1000,
  skewMs: 30 * 1000,
  idempotencyRetentionMs: 24 * 60 * 60 * 1000,
};

const AUDIENCE = "urn:stealth:recipient:alice";

function freshStores() {
  return {
    nonceStore: new MemoryNonceStore(),
    idempotencyStore: new MemoryIdempotencyStore(),
  };
}

function makePayload(overrides: Partial<SignedPayload> = {}): SignedPayload {
  return {
    method: "POST",
    path: "/v1/messages",
    query: null,
    headers: { host: "relay.example" },
    body_hash: "d41d8cd98f00b204e9800998ecf8427e",
    created_at: new Date().toISOString(),
    nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    aud: AUDIENCE,
    ...overrides,
  };
}

function makeEnvelope(
  kp: { publicKey: string; secretKey: string },
  payloadOverrides: Partial<SignedPayload> = {},
): SignedEnvelope {
  const payload = makePayload(payloadOverrides);
  const signature = signPayload(kp.secretKey, payload);
  return { payload, signature, kid: "test-kid", alg: "Ed25519" };
}

// ---------------------------------------------------------------------------
// Conformance Test Suite
// ---------------------------------------------------------------------------

describe("Relay Auth Replay Protection", () => {
  let kp: { publicKey: string; secretKey: string };

  beforeEach(() => {
    kp = genKeypair();
  });

  // Conformance 1: First delivery within replay window → 200 OK
  it("1: accepts a valid first-time request", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // Conformance 2: Reuse same envelope within replay window → 409 nonce_replay
  it("2: rejects a replayed nonce with 409", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);

    // First delivery
    const first = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(first.ok).toBe(true);

    // Replay same envelope
    const second = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
    expect(second.error?.error).toBe("nonce_replay");
  });

  // Conformance 3: Replay after replay_window → 400 replay_detected
  it("3: rejects a request outside the replay window with 400/replay_detected", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope({
      created_at: new Date(Date.now() - config.replayWindowMs - config.skewMs - 1000).toISOString(),
    });

    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error?.error).toBe("replay_detected");
  });

  // Conformance 4: Modify body but keep old signature → 401 invalid_signature
  it("4: rejects a tampered body with 401/invalid_signature", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);

    // Tamper with the payload
    envelope.payload.body_hash = "tampered-hash";
    // Signature is now stale

    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error?.error).toBe("invalid_signature");
  });

  // Conformance 5: Replay via different relay - same nonce, same KID → 409 nonce_replay
  it("5: rejects cross-relay replay with 409/nonce_replay (nonce store is global)", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);

    // First relay accepts it
    const first = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(first.ok).toBe(true);

    // Second relay (same recipient, global nonce store) rejects it
    const second = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(second.ok).toBe(false);
    expect(second.status).toBe(409);
    expect(second.error?.error).toBe("nonce_replay");
  });

  // Conformance 6: Future created_at beyond skew → 400 invalid_timestamp
  it("6: rejects a future timestamp beyond skew with 400/invalid_timestamp", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope({
      created_at: new Date(Date.now() + config.skewMs + 1000).toISOString(),
    });

    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error?.error).toBe("invalid_timestamp");
  });

  // Conformance 7: Valid idempotent duplicate with idempotency_key → replay with same response + X-Idempotency-Replayed
  it("7: returns cached response for idempotency key replay", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const idempotencyKey = "idem-001";
    const envelope1 = makeEnvelope({ idempotency_key: idempotencyKey });

    // First request - passes validation
    const first = validateSignedRequest(
      envelope1,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(first.ok).toBe(true);

    // Store a cached response for this idempotency key
    const idemKey = `${envelope1.kid}:${idempotencyKey}`;
    idempotencyStore.set(idemKey, {
      status: 200,
      body: { result: "ok", id: "msg-1" },
      timestamp: Date.now(),
    });

    // Replay with same idempotency key (different nonce)
    const envelope2 = makeEnvelope({
      idempotency_key: idempotencyKey,
      nonce: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
    });

    const second = validateSignedRequest(
      envelope2,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(second.ok).toBe(false);
    expect(second.status).toBe(200);
    expect(second.error?.error).toBe("idempotency_replay");
    expect(second.record).toBeDefined();
    expect(second.record?.body).toEqual({ result: "ok", id: "msg-1" });
  });

  // Conformance 8: Missing kid → envelope validation fails
  it("8: rejects envelope with missing kid with 400", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    envelope.kid = "";

    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error?.error).toBe("invalid_request");
  });

  // Negative vector: Audience mismatch → 403 invalid_audience
  it("rejects audience mismatch with 403/invalid_audience", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope({ aud: "urn:other:recipient" });

    const result = validateSignedRequest(
      envelope,
      kp.publicKey,
      { ...config, audience: AUDIENCE },
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error?.error).toBe("invalid_audience");
  });

  // Negative vector: Unknown public key → 401 invalid_signature
  it("rejects request with wrong public key with 401/invalid_signature", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const wrongKp = genKeypair();
    const envelope = makeEnvelope(kp);

    // Verify with wrong key
    const result = validateSignedRequest(
      envelope,
      wrongKp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error?.error).toBe("invalid_signature");
  });

  // Negative vector: Nonce store loss (simulated by reset) → replay accepted after reset
  it("accepts replay after nonce store reset (store loss scenario)", () => {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);

    // First delivery
    const first = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(first.ok).toBe(true);

    // Store loss (restart)
    nonceStore.reset();

    // Replay now accepted (known risk - mitigated by persistent store)
    const second = validateSignedRequest(
      envelope,
      kp.publicKey,
      config,
      nonceStore,
      idempotencyStore,
      Date.now(),
    );
    expect(second.ok).toBe(true);
  });

  // Timestamp validation unit tests
  describe("validateTimestamp", () => {
    const skewMs = 30_000;
    const windowMs = 120_000;

    it("accepts timestamps within the valid window", () => {
      const result = validateTimestamp(
        new Date(Date.now() - 60_000).toISOString(),
        Date.now(),
        skewMs,
        windowMs,
      );
      expect(result.ok).toBe(true);
    });

    it("rejects timestamps too far in the future", () => {
      const result = validateTimestamp(
        new Date(Date.now() + 60_000).toISOString(),
        Date.now(),
        skewMs,
        windowMs,
      );
      expect(result.ok).toBe(false);
      expect(result.error?.error).toBe("invalid_timestamp");
    });

    it("rejects timestamps too far in the past", () => {
      const result = validateTimestamp(
        new Date(Date.now() - 180_000).toISOString(),
        Date.now(),
        skewMs,
        windowMs,
      );
      expect(result.ok).toBe(false);
      expect(result.error?.error).toBe("replay_detected");
    });

    it("rejects unparseable timestamps", () => {
      const result = validateTimestamp("not-a-timestamp", Date.now(), skewMs, windowMs);
      expect(result.ok).toBe(false);
      expect(result.error?.error).toBe("invalid_timestamp");
    });

    it("accepts timestamps exactly at the future skew boundary", () => {
      const result = validateTimestamp(
        new Date(Date.now() + skewMs).toISOString(),
        Date.now(),
        skewMs,
        windowMs,
      );
      expect(result.ok).toBe(true);
    });

    it("accepts timestamps exactly at the past replay boundary", () => {
      const result = validateTimestamp(
        new Date(Date.now() - windowMs - skewMs).toISOString(),
        Date.now(),
        skewMs,
        windowMs,
      );
      expect(result.ok).toBe(true);
    });
  });

  // Nonce replay unit tests
  describe("checkNonceReplay", () => {
    it("allows first use of a nonce", () => {
      const store = new MemoryNonceStore();
      const result = checkNonceReplay("abc123", "kid-1", store);
      expect(result.ok).toBe(true);

      store.set("kid-1:abc123", Date.now());
    });

    it("rejects a replayed nonce", () => {
      const store = new MemoryNonceStore();
      store.set("kid-1:abc123", Date.now());

      const result = checkNonceReplay("abc123", "kid-1", store);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(409);
      expect(result.error?.error).toBe("nonce_replay");
    });

    it("allows same nonce for different kid", () => {
      const store = new MemoryNonceStore();
      store.set("kid-1:abc123", Date.now());

      const result = checkNonceReplay("abc123", "kid-2", store);
      expect(result.ok).toBe(true);
    });
  });

  // Idempotency unit tests
  describe("checkIdempotency", () => {
    it("passes through when no idempotency key", () => {
      const store = new MemoryIdempotencyStore();
      const result = checkIdempotency(undefined, "kid-1", store);
      expect(result.ok).toBe(true);
    });

    it("allows first use of an idempotency key", () => {
      const store = new MemoryIdempotencyStore();
      const result = checkIdempotency("idem-1", "kid-1", store);
      expect(result.ok).toBe(true);
    });

    it("returns cached record on idempotency key replay", () => {
      const store = new MemoryIdempotencyStore();
      store.set("kid-1:idem-1", { status: 200, body: { ok: true }, timestamp: Date.now() });

      const result = checkIdempotency("idem-1", "kid-1", store);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(200);
      expect(result.error?.error).toBe("idempotency_replay");
      expect(result.record).toBeDefined();
    });
  });

  // Audience validation unit tests
  describe("validateAudience", () => {
    it("passes when audience matches", () => {
      const result = validateAudience("urn:test:alice", "urn:test:alice");
      expect(result.ok).toBe(true);
    });

    it("passes when audience is in allowed list", () => {
      const result = validateAudience("urn:test:alice", ["urn:test:bob", "urn:test:alice"]);
      expect(result.ok).toBe(true);
    });

    it("rejects mismatched audience", () => {
      const result = validateAudience("urn:test:alice", "urn:test:bob");
      expect(result.ok).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error?.error).toBe("invalid_audience");
    });

    it("passes when no audience is configured", () => {
      const result = validateAudience("anything", undefined);
      expect(result.ok).toBe(true);
    });
  });
});
