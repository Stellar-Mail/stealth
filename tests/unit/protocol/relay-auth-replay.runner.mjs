/**
 * Standalone conformance test runner for Relay Auth Replay Protection.
 * Run: node tests/unit/protocol/relay-auth-replay.runner.mjs
 */
import { generateKeyPairSync, sign, verify, randomUUID } from "node:crypto";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (!condition) { console.error(`  FAIL: ${msg}`); failed++; }
  else { console.log(`  PASS: ${msg}`); passed++; }
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    console.error(`  FAIL: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

function assertDeepEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`  FAIL: ${msg} — expected ${e}, got ${a}`);
    failed++;
  } else {
    console.log(`  PASS: ${msg}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Inline signer — Ed25519 with PEM keys (compatible with Windows/OpenSSL3)
// ---------------------------------------------------------------------------

function genKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, secretKey: privateKey };
}

function stableSerialize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableSerialize(value[k])).join(",") + "}";
}

function canonicalize(obj) { return stableSerialize(obj); }

function encodeBase64Url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(s) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const full = remainder === 0 ? padded : padded + "===".slice(remainder);
  return Buffer.from(full, "base64");
}

function signPayload(secretKeyPem, payload) {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = sign(null, data, secretKeyPem);
  return encodeBase64Url(sig);
}

function verifySignature(publicKeyPem, payload, sigB64) {
  const data = Buffer.from(canonicalize(payload), "utf8");
  const sig = decodeBase64Url(sigB64);
  return verify(null, data, publicKeyPem, sig);
}

// ---------------------------------------------------------------------------
// Inline stores
// ---------------------------------------------------------------------------

class MemoryNonceStore {
  constructor() { this.store = new Map(); }
  has(key) { return this.store.has(key); }
  set(key, timestamp) { this.store.set(key, timestamp); }
  cleanup(before) { for (const [k, t] of this.store) if (t < before) this.store.delete(k); }
  reset() { this.store.clear(); }
}

class MemoryIdempotencyStore {
  constructor() { this.store = new Map(); }
  get(key) { return this.store.get(key) ?? null; }
  set(key, record) { this.store.set(key, record); }
  cleanup(before) { for (const [k, v] of this.store) if (v.timestamp < before) this.store.delete(k); }
  reset() { this.store.clear(); }
}

// ---------------------------------------------------------------------------
// Inline validation logic
// ---------------------------------------------------------------------------

function validateTimestamp(createdAt, nowMs, skewMs, replayWindowMs) {
  const created = Date.parse(createdAt);
  if (isNaN(created)) {
    return { ok: false, status: 400, error: { error: "invalid_timestamp", error_description: "created_at is not a valid RFC3339 timestamp" } };
  }
  if (created - nowMs > skewMs) {
    return { ok: false, status: 400, error: { error: "invalid_timestamp", error_description: "created_at is too far in the future" } };
  }
  if (nowMs - created > replayWindowMs + skewMs) {
    return { ok: false, status: 400, error: { error: "replay_detected", error_description: "request timestamp is outside the replay window" } };
  }
  return { ok: true };
}

function checkNonceReplay(nonce, kid, nonceStore) {
  const key = `${kid}:${nonce}`;
  if (nonceStore.has(key)) {
    return { ok: false, status: 409, error: { error: "nonce_replay", error_description: "nonce already seen for this key" } };
  }
  return { ok: true };
}

function checkIdempotency(idempotencyKey, kid, idempotencyStore) {
  if (!idempotencyKey) return { ok: true };
  const key = `${kid}:${idempotencyKey}`;
  const existing = idempotencyStore.get(key);
  if (existing) {
    return { ok: false, status: existing.status, record: existing, error: { error: "idempotency_replay", error_description: "idempotency key already processed" } };
  }
  return { ok: true };
}

function validateAudience(aud, expectedAudience) {
  if (!expectedAudience) return { ok: true };
  const audiences = Array.isArray(expectedAudience) ? expectedAudience : [expectedAudience];
  if (!audiences.includes(aud)) {
    return { ok: false, status: 403, error: { error: "invalid_audience", error_description: "aud does not match expected recipient" } };
  }
  return { ok: true };
}

function validateSignedRequest(envelope, publicKeyPem, config, nonceStore, idempotencyStore, nowMs) {
  if (!envelope.payload || !envelope.signature || !envelope.kid) {
    return { ok: false, status: 400, error: { error: "invalid_request", error_description: "missing envelope fields: payload, signature, or kid" } };
  }
  const verified = verifySignature(publicKeyPem, envelope.payload, envelope.signature);
  if (!verified) {
    return { ok: false, status: 401, error: { error: "invalid_signature", error_description: "signature verification failed" } };
  }
  const payload = envelope.payload;
  const tsResult = validateTimestamp(payload.created_at, nowMs, config.skewMs, config.replayWindowMs);
  if (!tsResult.ok) return tsResult;
  const audResult = validateAudience(payload.aud, config.audience);
  if (!audResult.ok) return audResult;
  const nonceResult = checkNonceReplay(payload.nonce, envelope.kid, nonceStore);
  if (!nonceResult.ok) return nonceResult;
  nonceStore.set(`${envelope.kid}:${payload.nonce}`, nowMs);
  const idemResult = checkIdempotency(payload.idempotency_key, envelope.kid, idempotencyStore);
  if (!idemResult.ok) return idemResult;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUDIENCE = "urn:stealth:recipient:alice";
const config = {
  replayWindowMs: 2 * 60 * 1000,
  skewMs: 30 * 1000,
  idempotencyRetentionMs: 24 * 60 * 60 * 1000,
};

function freshStores() {
  return { nonceStore: new MemoryNonceStore(), idempotencyStore: new MemoryIdempotencyStore() };
}

function makePayload(overrides = {}) {
  return {
    method: "POST",
    path: "/v1/messages",
    query: null,
    headers: { host: "relay.example" },
    body_hash: "d41d8cd98f00b204e9800998ecf8427e",
    created_at: new Date().toISOString(),
    nonce: randomUUID().replace(/-/g, "").slice(0, 24),
    aud: AUDIENCE,
    ...overrides,
  };
}

function makeEnvelope(kp, payloadOverrides = {}) {
  const payload = makePayload(payloadOverrides);
  const signature = signPayload(kp.secretKey, payload);
  return { payload, signature, kid: "test-kid", alg: "Ed25519" };
}

// ---------------------------------------------------------------------------
// Run all conformance tests
// ---------------------------------------------------------------------------

function runAll() {
  const kp = genKeypair();

  console.log("\n=== Relay Auth Replay Protection — Conformance Tests ===\n");

  // Test 1: First delivery within replay window => 200 OK
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    const result = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, true, "1: accepts a valid first-time request");
  }

  // Test 2: Reuse same envelope within replay window => 409 nonce_replay
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    const first = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(first.ok, true, "2a: first delivery succeeds");
    const second = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(second.ok, false, "2b: replay is rejected");
    assertEqual(second.status, 409, "2c: status is 409");
    assertEqual(second.error?.error, "nonce_replay", "2d: error is nonce_replay");
  }

  // Test 3: Replay after replay_window => 400 replay_detected
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp, {
      created_at: new Date(Date.now() - config.replayWindowMs - config.skewMs - 1000).toISOString(),
    });
    const result = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "3a: old request rejected");
    assertEqual(result.status, 400, "3b: status is 400");
    assertEqual(result.error?.error, "replay_detected", "3c: error is replay_detected");
  }

  // Test 4: Modify body but keep old signature => 401 invalid_signature
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    envelope.payload.body_hash = "tampered-hash";
    const result = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "4a: tampered body rejected");
    assertEqual(result.status, 401, "4b: status is 401");
    assertEqual(result.error?.error, "invalid_signature", "4c: error is invalid_signature");
  }

  // Test 5: Replay via different relay => 409 nonce_replay
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    const first = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(first.ok, true, "5a: first relay accepts");
    const second = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(second.ok, false, "5b: cross-relay replay rejected");
    assertEqual(second.status, 409, "5c: status is 409");
    assertEqual(second.error?.error, "nonce_replay", "5d: error is nonce_replay");
  }

  // Test 6: Future created_at beyond skew => 400 invalid_timestamp
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp, {
      created_at: new Date(Date.now() + config.skewMs + 1000).toISOString(),
    });
    const result = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "6a: future timestamp rejected");
    assertEqual(result.status, 400, "6b: status is 400");
    assertEqual(result.error?.error, "invalid_timestamp", "6c: error is invalid_timestamp");
  }

  // Test 7: Valid idempotent duplicate => cached response
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const idempotencyKey = "idem-001";
    const envelope1 = makeEnvelope(kp, { idempotency_key: idempotencyKey });
    const first = validateSignedRequest(envelope1, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(first.ok, true, "7a: first idempotent request accepted");
    const idemKey = `${envelope1.kid}:${idempotencyKey}`;
    idempotencyStore.set(idemKey, { status: 200, body: { result: "ok", id: "msg-1" }, timestamp: Date.now() });
    const envelope2 = makeEnvelope(kp, {
      idempotency_key: idempotencyKey,
      nonce: randomUUID().replace(/-/g, "").slice(0, 24),
    });
    const second = validateSignedRequest(envelope2, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(second.ok, false, "7b: idempotent replay intercepted");
    assertEqual(second.status, 200, "7c: status from cache is 200");
    assertEqual(second.error?.error, "idempotency_replay", "7d: error is idempotency_replay");
    assert(second.record !== undefined, "7e: record is returned");
    assertDeepEqual(second.record?.body, { result: "ok", id: "msg-1" }, "7f: cached body matches");
  }

  // Test 8: Missing kid => 400 invalid_request
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    envelope.kid = "";
    const result = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "8a: missing kid rejected");
    assertEqual(result.status, 400, "8b: status is 400");
    assertEqual(result.error?.error, "invalid_request", "8c: error is invalid_request");
  }

  // Negative: Audience mismatch => 403 invalid_audience
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp, { aud: "urn:other:recipient" });
    const audConfig = { ...config, audience: AUDIENCE };
    const result = validateSignedRequest(envelope, kp.publicKey, audConfig, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "N1: audience mismatch rejected");
    assertEqual(result.status, 403, "N2: status is 403");
    assertEqual(result.error?.error, "invalid_audience", "N3: error is invalid_audience");
  }

  // Negative: Wrong public key => 401 invalid_signature
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const wrongKp = genKeypair();
    const envelope = makeEnvelope(kp);
    const result = validateSignedRequest(envelope, wrongKp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(result.ok, false, "N4: wrong key rejected");
    assertEqual(result.status, 401, "N5: status is 401");
    assertEqual(result.error?.error, "invalid_signature", "N6: error is invalid_signature");
  }

  // Negative: Nonce store loss => replay accepted after reset
  {
    const { nonceStore, idempotencyStore } = freshStores();
    const envelope = makeEnvelope(kp);
    const first = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(first.ok, true, "N7: first delivery succeeds");
    nonceStore.reset();
    const second = validateSignedRequest(envelope, kp.publicKey, config, nonceStore, idempotencyStore, Date.now());
    assertEqual(second.ok, true, "N8: replay accepted after store loss (documented risk)");
  }

  // -----------------------------------------------------------------------
  // Timestamp validation unit tests
  // -----------------------------------------------------------------------
  console.log("\n=== validateTimestamp ===\n");

  {
    const r = validateTimestamp(new Date(Date.now() - 60000).toISOString(), Date.now(), 30000, 120000);
    assertEqual(r.ok, true, "accepts timestamps within the valid window");
  }
  {
    const r = validateTimestamp(new Date(Date.now() + 60000).toISOString(), Date.now(), 30000, 120000);
    assertEqual(r.ok, false, "rejects timestamps too far in the future");
    assertEqual(r.error?.error, "invalid_timestamp", "error is invalid_timestamp");
  }
  {
    const r = validateTimestamp(new Date(Date.now() - 180000).toISOString(), Date.now(), 30000, 120000);
    assertEqual(r.ok, false, "rejects timestamps too far in the past");
    assertEqual(r.error?.error, "replay_detected", "error is replay_detected");
  }
  {
    const r = validateTimestamp("not-a-timestamp", Date.now(), 30000, 120000);
    assertEqual(r.ok, false, "rejects unparseable timestamps");
    assertEqual(r.error?.error, "invalid_timestamp", "error is invalid_timestamp");
  }

  // -----------------------------------------------------------------------
  // Nonce replay unit tests
  // -----------------------------------------------------------------------
  console.log("\n=== checkNonceReplay ===\n");

  {
    const store = new MemoryNonceStore();
    const r = checkNonceReplay("abc123", "kid-1", store);
    assertEqual(r.ok, true, "allows first use of a nonce");
  }
  {
    const store = new MemoryNonceStore();
    store.set("kid-1:abc123", Date.now());
    const r = checkNonceReplay("abc123", "kid-1", store);
    assertEqual(r.ok, false, "rejects a replayed nonce");
    assertEqual(r.status, 409, "status is 409");
    assertEqual(r.error?.error, "nonce_replay", "error is nonce_replay");
  }
  {
    const store = new MemoryNonceStore();
    store.set("kid-1:abc123", Date.now());
    const r = checkNonceReplay("abc123", "kid-2", store);
    assertEqual(r.ok, true, "allows same nonce for different kid");
  }

  // -----------------------------------------------------------------------
  // Idempotency unit tests
  // -----------------------------------------------------------------------
  console.log("\n=== checkIdempotency ===\n");

  {
    const store = new MemoryIdempotencyStore();
    const r = checkIdempotency(undefined, "kid-1", store);
    assertEqual(r.ok, true, "passes through when no idempotency key");
  }
  {
    const store = new MemoryIdempotencyStore();
    const r = checkIdempotency("idem-1", "kid-1", store);
    assertEqual(r.ok, true, "allows first use of an idempotency key");
  }
  {
    const store = new MemoryIdempotencyStore();
    store.set("kid-1:idem-1", { status: 200, body: { ok: true }, timestamp: Date.now() });
    const r = checkIdempotency("idem-1", "kid-1", store);
    assertEqual(r.ok, false, "returns cached record on idempotency key replay");
    assertEqual(r.status, 200, "status is 200");
    assertEqual(r.error?.error, "idempotency_replay", "error is idempotency_replay");
    assert(r.record !== undefined, "record is returned");
  }

  // -----------------------------------------------------------------------
  // Audience validation unit tests
  // -----------------------------------------------------------------------
  console.log("\n=== validateAudience ===\n");

  {
    const r = validateAudience("urn:test:alice", "urn:test:alice");
    assertEqual(r.ok, true, "passes when audience matches");
  }
  {
    const r = validateAudience("urn:test:alice", ["urn:test:bob", "urn:test:alice"]);
    assertEqual(r.ok, true, "passes when audience is in allowed list");
  }
  {
    const r = validateAudience("urn:test:alice", "urn:test:bob");
    assertEqual(r.ok, false, "rejects mismatched audience");
    assertEqual(r.status, 403, "status is 403");
    assertEqual(r.error?.error, "invalid_audience", "error is invalid_audience");
  }
  {
    const r = validateAudience("anything", undefined);
    assertEqual(r.ok, true, "passes when no audience configured");
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  const total = passed + failed;
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed}/${total} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runAll();
