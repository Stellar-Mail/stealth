import { randomBytes as secureRandomBytes } from "node:crypto";

import { ApiError } from "../errors";

export const DEFAULT_AUTH_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_KEY_PREFIX = "auth:nonce";
const NONCE_BYTES = 32;
const MAX_GENERATION_ATTEMPTS = 3;

export interface NonceRecord {
  readonly nonce: string;
  readonly actor: string;
  readonly purpose: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly consumedAt?: string;
}

export type NonceConsumeResult =
  | { readonly outcome: "consumed"; readonly record: NonceRecord }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "expired"; readonly record: NonceRecord }
  | { readonly outcome: "replayed"; readonly record: NonceRecord }
  | { readonly outcome: "actor_mismatch"; readonly record: NonceRecord }
  | { readonly outcome: "purpose_mismatch"; readonly record: NonceRecord };

/**
 * Shared storage contract for nonce lifecycle state. Production adapters must
 * implement consume atomically (for example in a Durable Object or with a
 * database compare-and-swap), so concurrent requests cannot both succeed.
 */
export interface NonceStore {
  putIfAbsent(key: string, record: NonceRecord): Promise<boolean>;
  consume(key: string, actor: string, purpose: string, nowMs: number): Promise<NonceConsumeResult>;
  get(key: string): Promise<NonceRecord | null>;
}

export interface NonceServiceOptions {
  keyPrefix?: string;
  ttlMs?: number;
  now?: () => number;
  randomBytes?: (size: number) => Uint8Array;
  environment?: Record<string, string | undefined>;
}

function normalizeBinding(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new RangeError(`${name} must be a non-empty string`);
  return normalized;
}

export function getAuthNonceTtlMs(
  environment: Record<string, string | undefined> = process.env,
): number {
  const configured = environment.STEALTH_AUTH_NONCE_TTL_MS;
  if (configured === undefined || configured.trim() === "") return DEFAULT_AUTH_NONCE_TTL_MS;

  const ttlMs = Number(configured);
  if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error(
      "Configuration error: STEALTH_AUTH_NONCE_TTL_MS must be a positive integer number of milliseconds.",
    );
  }
  return ttlMs;
}

export class NonceService {
  private readonly store: NonceStore;
  private readonly keyPrefix: string;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly randomBytes: (size: number) => Uint8Array;

  constructor(store: NonceStore, options: NonceServiceOptions = {}) {
    this.store = store;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.ttlMs = options.ttlMs ?? getAuthNonceTtlMs(options.environment);
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs <= 0) {
      throw new RangeError("Nonce TTL must be a positive integer number of milliseconds");
    }
    this.now = options.now ?? Date.now;
    this.randomBytes = options.randomBytes ?? secureRandomBytes;
  }

  private key(nonce: string): string {
    return `${this.keyPrefix}:${nonce}`;
  }

  /** Issues and persists an unpredictable nonce bound to an actor and purpose. */
  async issue(actor: string, purpose: string): Promise<NonceRecord> {
    const normalizedActor = normalizeBinding(actor, "Actor");
    const normalizedPurpose = normalizeBinding(purpose, "Authentication purpose");

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const nowMs = this.now();
      const nonce = Buffer.from(this.randomBytes(NONCE_BYTES)).toString("hex");
      const record: NonceRecord = {
        nonce,
        actor: normalizedActor,
        purpose: normalizedPurpose,
        createdAt: new Date(nowMs).toISOString(),
        expiresAt: new Date(nowMs + this.ttlMs).toISOString(),
      };

      if (await this.store.putIfAbsent(this.key(nonce), record)) return record;
    }

    throw new ApiError(500, "internal_error", "Unable to generate a unique authentication nonce");
  }

  /**
   * Atomically consumes a nonce after verifying its actor, purpose, and expiry.
   * Any failure is rejected centrally and never returns authentication state.
   */
  async consume(nonce: string, actor: string, purpose: string): Promise<NonceRecord> {
    const normalizedNonce = normalizeBinding(nonce, "Nonce");
    const result = await this.store.consume(
      this.key(normalizedNonce),
      normalizeBinding(actor, "Actor"),
      normalizeBinding(purpose, "Authentication purpose"),
      this.now(),
    );

    switch (result.outcome) {
      case "consumed":
        return result.record;
      case "expired":
        throw new ApiError("expired_challenge");
      case "replayed":
        throw new ApiError(409, "conflict", "The authentication nonce has already been used");
      case "actor_mismatch":
      case "purpose_mismatch":
      case "not_found":
        throw new ApiError(401, "unauthorized", "The authentication nonce is invalid");
    }
  }

  async get(nonce: string): Promise<NonceRecord | null> {
    return this.store.get(this.key(normalizeBinding(nonce, "Nonce")));
  }
}

/** In-memory development/test implementation of the atomic store contract. */
export class InMemoryNonceStore implements NonceStore {
  private readonly entries = new Map<string, NonceRecord>();

  async putIfAbsent(key: string, record: NonceRecord): Promise<boolean> {
    if (this.entries.has(key)) return false;
    this.entries.set(key, record);
    return true;
  }

  async consume(
    key: string,
    actor: string,
    purpose: string,
    nowMs: number,
  ): Promise<NonceConsumeResult> {
    // Deliberately contains no await: lookup, validation, and mutation happen
    // in one microtask, giving this reference store compare-and-swap semantics.
    const record = this.entries.get(key);
    if (!record) return { outcome: "not_found" };
    if (Date.parse(record.expiresAt) <= nowMs) {
      this.entries.delete(key);
      return { outcome: "expired", record };
    }
    if (record.consumedAt) return { outcome: "replayed", record };
    if (record.actor !== actor) return { outcome: "actor_mismatch", record };
    if (record.purpose !== purpose) return { outcome: "purpose_mismatch", record };

    const consumed = { ...record, consumedAt: new Date(nowMs).toISOString() };
    this.entries.set(key, consumed);
    return { outcome: "consumed", record: consumed };
  }

  async get(key: string): Promise<NonceRecord | null> {
    return this.entries.get(key) ?? null;
  }

  reset(): void {
    this.entries.clear();
  }
}
