/**
 * Replay-safe, single-use authentication nonces backed by durable, shared
 * storage.
 *
 * Authentication nonces must be consumable exactly once. Tracking "seen"
 * nonces in process-local memory (for example a module-level `Set`) breaks in
 * two ways as soon as the API runs as more than a single long-lived process:
 *
 *   1. A nonce consumed on instance A is invisible to instance B, so the same
 *      signed request can be replayed against a sibling isolate.
 *   2. A restart or redeploy drops the in-memory set, so every previously seen
 *      nonce becomes replayable again.
 *
 * This module fixes both by delegating the "first consumer wins" decision to a
 * shared store behind an atomic put-if-absent. That mirrors the reasoning
 * already used for postage settlement and idempotency in this codebase: a
 * plain get-then-set cannot guarantee a single winner under concurrency, so
 * the atomic primitive must live in the shared store rather than in the caller.
 */

/** A nonce was accepted for the first time and is now consumed. */
export interface NonceConsumeFresh {
  readonly outcome: "fresh";
  readonly record: NonceRecord;
}

/** A nonce was already consumed; the request is a replay and must be rejected. */
export interface NonceConsumeReplayed {
  readonly outcome: "replayed";
  readonly firstConsumedAt: string;
}

export type NonceConsumeResult = NonceConsumeFresh | NonceConsumeReplayed;

/** A consumed nonce and the window during which it stays reserved. */
export interface NonceRecord {
  readonly nonce: string;
  /** ISO-8601 timestamp of the first (winning) consume. */
  readonly consumedAt: string;
  /** ISO-8601 timestamp after which the nonce may be reused. */
  readonly expiresAt: string;
}

/**
 * Durable, shared storage primitive the nonce service depends on.
 *
 * Implementations MUST provide an atomic put-if-absent: for a given key,
 * exactly one concurrent caller stores its record and receives `true`, and
 * every other concurrent or later caller receives `false`. This single-winner
 * guarantee is the whole point of the store, so it must not be implemented as
 * a separate `has()` followed by `set()`, which reintroduces the race it is
 * meant to prevent.
 *
 * A production deployment backs this with durable, cross-instance storage (for
 * example Workers KV plus the Durable Object coordinator already used for
 * postage and idempotency, or a Redis `SET key value NX PX ttl`). The
 * in-memory implementation below is the shared reference used in dev and
 * tests, exactly as MemoryApiRepository mirrors HybridApiRepository.
 */
export interface NonceStore {
  /**
   * Atomically reserve `key` unless a live (unexpired) record already holds it.
   * Returns `true` when this call stored `record` (fresh), `false` when a live
   * record already existed (replay).
   */
  putIfAbsent(key: string, record: NonceRecord, nowMs: number): Promise<boolean>;
  /** Read the live record for `key`, or `null` if absent or expired. */
  get(key: string, nowMs: number): Promise<NonceRecord | null>;
}

export interface NonceServiceOptions {
  /** Key namespace so nonce entries never collide with other stored data. */
  keyPrefix?: string;
  /** How long a consumed nonce stays reserved before it may be reused. */
  ttlMs?: number;
  /** Injectable clock, primarily for deterministic tests. */
  now?: () => number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_KEY_PREFIX = "auth:nonce";

export class NonceService {
  private readonly store: NonceStore;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(store: NonceStore, options: NonceServiceOptions = {}) {
    this.store = store;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? (() => Date.now());
  }

  private key(nonce: string): string {
    return `${this.keyPrefix}:${nonce}`;
  }

  /**
   * Atomically consume a nonce. The first caller for a given nonce receives
   * `{ outcome: "fresh" }`; any concurrent or later caller receives
   * `{ outcome: "replayed" }`. Because the decision is delegated to the shared
   * store, the result is identical across runtime instances and survives
   * process restarts for as long as the store is durable.
   */
  async consume(nonce: string): Promise<NonceConsumeResult> {
    const normalized = nonce.trim();
    if (normalized.length === 0) {
      throw new RangeError("Nonce must be a non-empty string");
    }

    const nowMs = this.now();
    const record: NonceRecord = {
      nonce: normalized,
      consumedAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + this.ttlMs).toISOString(),
    };

    const stored = await this.store.putIfAbsent(this.key(normalized), record, nowMs);
    if (stored) {
      return { outcome: "fresh", record };
    }

    const existing = await this.store.get(this.key(normalized), nowMs);
    return {
      outcome: "replayed",
      firstConsumedAt: existing?.consumedAt ?? record.consumedAt,
    };
  }

  /** Whether `nonce` is currently consumed (present and not expired). */
  async isConsumed(nonce: string): Promise<boolean> {
    const existing = await this.store.get(this.key(nonce.trim()), this.now());
    return existing !== null;
  }
}

/**
 * In-memory NonceStore used in dev and tests. It is the shared reference
 * implementation of the store contract, not a production backend: two services
 * sharing one instance behave like two runtime instances sharing one durable
 * store, but its state does not outlive the process. Production wiring supplies
 * a durable, cross-instance store (see the interface docs).
 */
export class InMemoryNonceStore implements NonceStore {
  private readonly entries = new Map<string, NonceRecord>();

  async putIfAbsent(key: string, record: NonceRecord, nowMs: number): Promise<boolean> {
    // No `await` runs between this read and the write below, so the
    // check-then-act sequence completes within a single microtask and cannot
    // interleave with a concurrent call for the same key. That is what makes
    // the single-winner guarantee hold, matching MemoryApiRepository.
    const existing = this.entries.get(key);
    if (existing && Date.parse(existing.expiresAt) > nowMs) {
      return false;
    }
    this.entries.set(key, record);
    return true;
  }

  async get(key: string, nowMs: number): Promise<NonceRecord | null> {
    const existing = this.entries.get(key);
    if (!existing) {
      return null;
    }
    if (Date.parse(existing.expiresAt) <= nowMs) {
      this.entries.delete(key);
      return null;
    }
    return existing;
  }

  /** Test helper: drop all reserved nonces. */
  reset(): void {
    this.entries.clear();
  }
}
