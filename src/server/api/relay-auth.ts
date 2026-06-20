import { verifySignature } from "../../services/crypto/signer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SignedPayload {
  method: string;
  path: string;
  query: string | null;
  headers: Record<string, string>;
  body_hash: string;
  created_at: string;
  expires_at?: string;
  nonce: string;
  aud: string;
  idempotency_key?: string;
}

export interface SignedEnvelope {
  payload: SignedPayload;
  signature: string;
  kid: string;
  alg: string;
}

export interface RelayAuthError {
  error: string;
  error_description: string;
  error_details?: Record<string, unknown>;
}

export interface RelayAuthResult {
  ok: boolean;
  error?: RelayAuthError;
  status?: number;
}

// ---------------------------------------------------------------------------
// Store interfaces
// ---------------------------------------------------------------------------

export interface NonceStore {
  has(key: string): Promise<boolean> | boolean;
  set(key: string, timestamp: number): Promise<void> | void;
  cleanup(before: number): Promise<void> | void;
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null> | IdempotencyRecord | null;
  set(key: string, record: IdempotencyRecord): Promise<void> | void;
  cleanup(before: number): Promise<void> | void;
}

export interface IdempotencyRecord {
  status: number;
  body: unknown;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Memory implementations
// ---------------------------------------------------------------------------

export class MemoryNonceStore implements NonceStore {
  private readonly store = new Map<string, number>();

  has(key: string): boolean {
    return this.store.has(key);
  }

  set(key: string, timestamp: number): void {
    this.store.set(key, timestamp);
  }

  cleanup(before: number): void {
    for (const [k, t] of this.store) {
      if (t < before) this.store.delete(k);
    }
  }

  size(): number {
    return this.store.size;
  }

  reset(): void {
    this.store.clear();
  }
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly store = new Map<string, IdempotencyRecord>();

  get(key: string): IdempotencyRecord | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, record: IdempotencyRecord): void {
    this.store.set(key, record);
  }

  cleanup(before: number): void {
    for (const [k, v] of this.store) {
      if (v.timestamp < before) this.store.delete(k);
    }
  }

  reset(): void {
    this.store.clear();
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface RelayAuthConfig {
  replayWindowMs: number;
  skewMs: number;
  idempotencyRetentionMs: number;
  audience?: string | string[];
}

export const defaultConfig: RelayAuthConfig = {
  replayWindowMs: 2 * 60 * 1000,
  skewMs: 30 * 1000,
  idempotencyRetentionMs: 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

export function validateTimestamp(
  createdAt: string,
  nowMs: number,
  skewMs: number,
  replayWindowMs: number,
): RelayAuthResult {
  const created = Date.parse(createdAt);
  if (isNaN(created)) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "invalid_timestamp",
        error_description: "created_at is not a valid RFC3339 timestamp",
      },
    };
  }

  if (created - nowMs > skewMs) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "invalid_timestamp",
        error_description: "created_at is too far in the future",
      },
    };
  }

  if (nowMs - created > replayWindowMs + skewMs) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "replay_detected",
        error_description: "request timestamp is outside the replay window",
      },
    };
  }

  return { ok: true };
}

export function checkNonceReplay(
  nonce: string,
  kid: string,
  nonceStore: NonceStore,
): RelayAuthResult {
  const key = `${kid}:${nonce}`;
  if (nonceStore.has(key)) {
    return {
      ok: false,
      status: 409,
      error: {
        error: "nonce_replay",
        error_description: "nonce already seen for this key",
      },
    };
  }
  return { ok: true };
}

export function checkIdempotency(
  idempotencyKey: string | undefined,
  kid: string,
  idempotencyStore: IdempotencyStore,
): RelayAuthResult & { record?: IdempotencyRecord } {
  if (!idempotencyKey) return { ok: true };

  const key = `${kid}:${idempotencyKey}`;
  const existing = idempotencyStore.get(key);
  if (existing) {
    return {
      ok: false,
      status: existing.status,
      record: existing,
      error: {
        error: "idempotency_replay",
        error_description: "idempotency key already processed",
      },
    };
  }
  return { ok: true };
}

export function validateAudience(
  aud: string,
  expectedAudience: string | string[] | undefined,
): RelayAuthResult {
  if (!expectedAudience) return { ok: true };

  const audiences = Array.isArray(expectedAudience) ? expectedAudience : [expectedAudience];
  if (!audiences.includes(aud)) {
    return {
      ok: false,
      status: 403,
      error: {
        error: "invalid_audience",
        error_description: "aud does not match expected recipient",
      },
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Main validation entry point
// ---------------------------------------------------------------------------

export function validateSignedRequest(
  envelope: SignedEnvelope,
  publicKey: string,
  config: RelayAuthConfig,
  nonceStore: NonceStore,
  idempotencyStore: IdempotencyStore,
  nowMs: number,
): RelayAuthResult & { record?: IdempotencyRecord } {
  // 1. Validate envelope structure
  if (!envelope.payload || !envelope.signature || !envelope.kid) {
    return {
      ok: false,
      status: 400,
      error: {
        error: "invalid_request",
        error_description: "missing envelope fields: payload, signature, or kid",
      },
    };
  }

  // 2. Verify signature
  const verified = verifySignature(publicKey, envelope.payload, envelope.signature);
  if (!verified) {
    return {
      ok: false,
      status: 401,
      error: {
        error: "invalid_signature",
        error_description: "signature verification failed",
      },
    };
  }

  const payload = envelope.payload;

  // 3. Validate timestamp
  const tsResult = validateTimestamp(payload.created_at, nowMs, config.skewMs, config.replayWindowMs);
  if (!tsResult.ok) return tsResult;

  // 4. Validate audience
  const audResult = validateAudience(payload.aud, config.audience);
  if (!audResult.ok) return audResult;

  // 5. Check nonce replay
  const nonceResult = checkNonceReplay(payload.nonce, envelope.kid, nonceStore);
  if (!nonceResult.ok) return nonceResult;

  // 6. Store nonce
  nonceStore.set(`${envelope.kid}:${payload.nonce}`, nowMs);

  // 7. Check idempotency
  const idemResult = checkIdempotency(payload.idempotency_key, envelope.kid, idempotencyStore);
  if (!idemResult.ok) return idemResult;

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function startCleanupLoop(
  nonceStore: NonceStore,
  idempotencyStore: IdempotencyStore,
  replayWindowMs: number,
  idempotencyRetentionMs: number,
  intervalMs = 30_000,
): () => void {
  const timer = setInterval(() => {
    const cutoff = Date.now() - replayWindowMs - 60_000;
    nonceStore.cleanup(cutoff);
    const idemCutoff = Date.now() - idempotencyRetentionMs;
    idempotencyStore.cleanup(idemCutoff);
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
