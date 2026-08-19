import { createHash } from "node:crypto";
import type { ApiRepository, AcquireIdempotencyResult } from "./repository";
import type { IdempotencyRecord } from "./domain";
import { canonicalize } from "./envelope";
import { ApiError } from "./errors";

const DEFAULT_LEASE_MS = 30000;

/**
 * Issue #1498: idempotency records are persisted keyed by actor, HTTP
 * method, and route template (in addition to the client-supplied key), so
 * the same raw key cannot collide across unrelated endpoints or verbs.
 *
 * Issue #1501: canonicalize the raw key before hashing so semantically
 * identical JSON (different key order) hashes the same, while genuinely
 * different values still conflict. Array order, numeric/string
 * distinctions, and the actor/method/route scope all remain significant.
 */
export function hashIdempotencyKey(
  actor: string,
  method: string,
  route: string,
  rawKey: unknown,
): string {
  const canonicalKey = canonicalize(rawKey);
  return createHash("sha256").update(`${actor}:${method}:${route}:${canonicalKey}`).digest("hex");
}

/** Canonical digest of a request payload, bound into the stored lease/response. */
export function computeRequestDigest(rawBody: unknown): string {
  return createHash("sha256").update(canonicalize(rawBody)).digest("hex");
}

export interface IdempotencyScope {
  actor: string;
  method: string;
  route: string;
  rawKey: string;
}

/**
 * Acquires an idempotency lease for the given scope, binding it to a
 * canonical digest of `rawBody`. Callers use the low-level result to decide
 * how to react; most routes should prefer {@link withIdempotency} instead.
 */
export async function acquireIdempotency(
  repository: ApiRepository,
  scope: IdempotencyScope,
  rawBody: unknown,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<AcquireIdempotencyResult> {
  const keyHash = hashIdempotencyKey(scope.actor, scope.method, scope.route, scope.rawKey);
  const requestDigest = computeRequestDigest(rawBody);
  return repository.acquireIdempotencyRecord(keyHash, requestDigest, leaseMs);
}

/** Records the terminal outcome of an operation for future idempotent replay. */
export async function recordIdempotency(
  repository: ApiRepository,
  scope: IdempotencyScope,
  rawBody: unknown,
  status: number,
  body: unknown,
): Promise<void> {
  const keyHash = hashIdempotencyKey(scope.actor, scope.method, scope.route, scope.rawKey);
  const requestDigest = computeRequestDigest(rawBody);
  const now = new Date().toISOString();

  // Preserve the original createdAt across the in_progress -> completed
  // transition, falling back to now if the lease record is somehow absent.
  const existing = await repository.getIdempotencyRecord(keyHash);
  const createdAt = existing ? existing.createdAt : now;

  const record: IdempotencyRecord = {
    state: "completed",
    status,
    body,
    requestDigest,
    createdAt,
    completedAt: now,
  };
  await repository.setIdempotencyRecord(keyHash, record);
}

/**
 * Releases an in-flight lease without recording a completed response, so an
 * immediate retry with the same key/payload can re-acquire right away
 * instead of waiting out the full lease TTL. Used after a transient failure
 * that was deliberately left uncached (see {@link WithIdempotencyOptions}).
 */
async function releaseIdempotencyLease(
  repository: ApiRepository,
  scope: IdempotencyScope,
  rawBody: unknown,
): Promise<void> {
  const keyHash = hashIdempotencyKey(scope.actor, scope.method, scope.route, scope.rawKey);
  const requestDigest = computeRequestDigest(rawBody);
  const existing = await repository.getIdempotencyRecord(keyHash);
  const createdAt = existing ? existing.createdAt : new Date().toISOString();

  await repository.setIdempotencyRecord(keyHash, {
    state: "in_progress",
    requestDigest,
    createdAt,
    // Already expired, so the next acquire treats the lease as abandoned
    // and proceeds immediately rather than blocking for up to leaseMs.
    recoveryExpiryAt: new Date(0).toISOString(),
  });
}

export interface IdempotentOutcome<T> {
  status: number;
  body: T;
  /** True when this response was replayed from a prior request rather than freshly computed. */
  replayed: boolean;
}

export interface WithIdempotencyOptions {
  leaseMs?: number;
  /**
   * ApiError statuses whose response should also be cached and replayed
   * (e.g. a deterministic 409 for an already-settled resource). Statuses
   * not listed here are treated as transient and are never cached, so a
   * failed attempt can be retried with the same key.
   */
  cacheableErrorStatuses?: readonly number[];
}

/**
 * Runs a mutating operation under a durable idempotency lease.
 *
 * - No prior record for this actor/method/route/key: runs `operation` once
 *   and persists its outcome for future replay.
 * - A matching in-flight lease: throws `request_in_progress` (409) so a
 *   concurrent duplicate can never execute the operation twice.
 * - A matching completed record: replays the stored response without
 *   re-running `operation`.
 * - The same key reused with a different request payload: throws
 *   `idempotency_mismatch` (409) rather than blocking behind or replaying
 *   an unrelated request's response.
 */
export async function withIdempotency<T>(
  repository: ApiRepository,
  scope: IdempotencyScope,
  rawBody: unknown,
  operation: () => Promise<{ status: number; body: T }>,
  options: WithIdempotencyOptions = {},
): Promise<IdempotentOutcome<T>> {
  const acquireResult = await acquireIdempotency(
    repository,
    scope,
    rawBody,
    options.leaseMs ?? DEFAULT_LEASE_MS,
  );

  if (acquireResult.status === "conflict") {
    throw new ApiError("idempotency_mismatch");
  }
  if (acquireResult.status === "in_progress") {
    throw new ApiError("request_in_progress");
  }
  if (acquireResult.status === "completed") {
    return {
      status: acquireResult.record.status,
      body: acquireResult.record.body as T,
      replayed: true,
    };
  }

  try {
    const result = await operation();
    await recordIdempotency(repository, scope, rawBody, result.status, result.body);
    return { ...result, replayed: false };
  } catch (error) {
    const cacheable = options.cacheableErrorStatuses ?? [];
    if (error instanceof ApiError && cacheable.includes(error.status)) {
      await recordIdempotency(repository, scope, rawBody, error.status, {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
    } else {
      // Transient failure: don't leave a live lease behind, or a legitimate
      // retry with the same key would be wrongly rejected as in-progress
      // until the lease expires.
      await releaseIdempotencyLease(repository, scope, rawBody);
    }
    throw error;
  }
}
