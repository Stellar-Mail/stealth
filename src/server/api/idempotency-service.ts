/**
 * Persistent Idempotency Service
 *
 * This module provides production-grade, persistent idempotency management across process
 * restarts and distributed API instances.
 *
 * ## Architecture & Concepts
 *
 * ### 1. Persistence Model
 * Each idempotency record is keyed deterministically by:
 * `actor` + `method` + `canonicalRoute` + `idempotencyKey`
 *
 * Records are stored using the repository's underlying persistence layer (`ApiRepository`),
 * ensuring durability across process restarts and horizontally scaled deployments.
 *
 * Record fields include:
 * - `actor`: The authenticated user/client address or ID.
 * - `method`: Normalized HTTP method (e.g. "POST").
 * - `route`: Normalized canonical route path (e.g. "/api/v1/postage/settle").
 * - `key`: Raw idempotency key header (`x-idempotency-key`).
 * - `digest`: SHA-256 hash of the canonical request (method, route, canonical JSON body).
 * - `status`: HTTP response status code (e.g. 200, 201).
 * - `body`: Stored JSON response payload.
 * - `createdAt`: ISO 8601 creation timestamp.
 * - `completedAt`: ISO 8601 completion timestamp (for completed records).
 * - `recoveryExpiryAt`: ISO 8601 lease expiration timestamp (for in-progress locks).
 *
 * ### 2. Canonical Request Digest
 * To prevent key re-use with different request payloads, a deterministic digest is generated:
 * `SHA-256(method + ":" + canonicalRoute + ":" + canonicalize(body))`
 *
 * `canonicalize()` guarantees stable JSON key sorting per RFC 8785 / JCS rules.
 *
 * ### 3. Replay Semantics & Conflict Handling
 * When an incoming request carries an idempotency key:
 * - **No Record / Expired Lease**: The operation acquires an atomic lock, executes, persists the response, and returns it.
 * - **Matching Completed Record**: If the request digest matches the stored record, the cached response is replayed immediately.
 * - **Digest Mismatch (Key Re-use)**: If an idempotency key is re-used with a different request payload, method, or route, the service returns `409 Conflict` with code `IDEMPOTENCY_KEY_REUSED`.
 *
 * ### 4. Concurrency & Lock Recovery
 * - Simultaneous identical requests acquire an atomic `in_progress` lease in the repository.
 * - Only one request proceeds to execute the handler.
 * - Follower requests wait asynchronously (`waitForIdempotencyCompletion`) until the leader completes, then return the replayed response.
 * - If a leader process crashes before completing, the lease expires after `leaseMs` (default 30s) and a subsequent request can cleanly re-acquire the lock for execution.
 *
 * ## Usage Example
 * ```ts
 * import { executeIdempotentRequest } from "./idempotency-service";
 *
 * const result = await executeIdempotentRequest({
 *   repository,
 *   actor: "GABC...",
 *   method: "POST",
 *   route: "/api/v1/postage",
 *   key: request.headers.get("x-idempotency-key")!,
 *   body: parsedBody,
 *   handler: async () => {
 *     return await submitPostage(repository, parsedBody);
 *   },
 * });
 *
 * return apiSuccess(request, result.body, {
 *   status: result.status,
 *   headers: result.isReplay ? { "x-idempotency-replayed": "true" } : undefined,
 * });
 * ```
 */

import { createHash } from "node:crypto";
import type { ApiRepository, AcquireIdempotencyResult } from "./repository";
import type { IdempotencyRecord } from "./domain";
import { canonicalize } from "./envelope";
import { ApiError } from "./errors";
import * as metrics from "./metrics";

export interface IdempotencyMetadata {
  actor: string;
  method?: string;
  route?: string;
  key?: string;
  digest?: string;
}

export interface ExecuteIdempotentRequestOptions<T = unknown> {
  repository: ApiRepository;
  actor: string;
  method: string;
  route: string;
  key: string;
  body?: unknown;
  leaseMs?: number;
  timeoutMs?: number;
  handler: () => Promise<{ status: number; body: T }> | { status: number; body: T };
}

export interface IdempotentExecutionResult<T = unknown> {
  isReplay: boolean;
  status: number;
  body: T;
  record: IdempotencyRecord & { state: "completed" };
}

/**
 * Computes a deterministic SHA-256 digest for an HTTP request using method, route,
 * and canonical JSON request body serialization.
 */
export function computeCanonicalDigest(method: string, route: string, body?: unknown): string {
  const methodNormalized = (method || "POST").toUpperCase().trim();
  const routeNormalized = (route || "/").toLowerCase().trim();
  const canonicalBody = canonicalize(body ?? null);
  const payload = `${methodNormalized}:${routeNormalized}:${canonicalBody}`;

  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Generates a deterministic storage key for the repository.
 * Supports 4-argument signature `(actor, method, route, key)` and 2-argument legacy signature `(actor, rawKey)`.
 */
export function hashIdempotencyKey(
  actor: string,
  methodOrRawKey: unknown,
  route?: string,
  rawKey?: string,
): string {
  if (
    typeof methodOrRawKey === "string" &&
    typeof route === "string" &&
    typeof rawKey === "string"
  ) {
    const methodNorm = methodOrRawKey.toUpperCase().trim();
    const routeNorm = route.toLowerCase().trim();
    const keyCanonical = canonicalize(rawKey);
    return createHash("sha256")
      .update(`${actor}:${methodNorm}:${routeNorm}:${keyCanonical}`)
      .digest("hex");
  }

  // Legacy signature: hashIdempotencyKey(actor, rawKey)
  const canonical = canonicalize(methodOrRawKey);
  return createHash("sha256").update(`${actor}:${canonical}`).digest("hex");
}

/**
 * Low-level lease acquisition. Resolves storage key and delegates to repository.
 */
export async function acquireIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  leaseMs = 30000,
  method?: string,
  route?: string,
): Promise<AcquireIdempotencyResult> {
  const keyHash =
    method && route
      ? hashIdempotencyKey(actor, method, route, rawKey)
      : hashIdempotencyKey(actor, rawKey);

  return repository.acquireIdempotencyRecord(keyHash, leaseMs);
}

/**
 * Checks for a completed idempotency record without acquiring a lease lock.
 */
export async function checkIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  method?: string,
  route?: string,
): Promise<IdempotencyRecord | null> {
  const keyHash =
    method && route
      ? hashIdempotencyKey(actor, method, route, rawKey)
      : hashIdempotencyKey(actor, rawKey);

  const result = await repository.acquireIdempotencyRecord(keyHash, 30000);
  if (result.status === "completed") {
    return result.record;
  }
  return null;
}

/**
 * Persists a completed idempotency response into the repository.
 */
export async function recordIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  status: number,
  body: unknown,
  metadata?: IdempotencyMetadata,
): Promise<void> {
  const keyHash =
    metadata?.method && metadata?.route
      ? hashIdempotencyKey(actor, metadata.method, metadata.route, rawKey)
      : hashIdempotencyKey(actor, rawKey);

  const now = new Date().toISOString();
  const existing = await repository.getIdempotencyRecord(keyHash);
  const createdAt = existing ? existing.createdAt : now;

  const record: IdempotencyRecord = {
    state: "completed",
    status,
    body,
    createdAt,
    completedAt: now,
    actor: metadata?.actor ?? actor,
    method: metadata?.method,
    route: metadata?.route,
    key: metadata?.key ?? rawKey,
    digest: metadata?.digest,
  };

  await repository.setIdempotencyRecord(keyHash, record);

  metrics.incrementCounter("domain_transition_total", {
    entity: "idempotency",
    from: "in_progress",
    to: "completed",
  });
}

/**
 * Polls the repository until an in-progress idempotency operation completes or times out.
 */
export async function waitForIdempotencyCompletion(
  repository: ApiRepository,
  storageKey: string,
  timeoutMs = 30000,
  pollIntervalMs = 50,
): Promise<IdempotencyRecord & { state: "completed" }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const record = await repository.getIdempotencyRecord(storageKey);
    if (record && record.state === "completed") {
      return record;
    }
    if (
      record &&
      record.state === "in_progress" &&
      Date.now() >= new Date(record.recoveryExpiryAt).getTime()
    ) {
      throw new ApiError(409, "request_in_progress", "In-progress request lease expired");
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new ApiError(
    409,
    "request_in_progress",
    "Timed out waiting for concurrent request to complete",
  );
}

/**
 * End-to-end idempotent request execution.
 *
 * Handles canonical digest validation, atomic lock acquisition, concurrent follower waiting,
 * key re-use conflict detection (409 IDEMPOTENCY_KEY_REUSED), and response caching.
 */
export async function executeIdempotentRequest<T = unknown>(
  options: ExecuteIdempotentRequestOptions<T>,
): Promise<IdempotentExecutionResult<T>> {
  const {
    repository,
    actor,
    method,
    route,
    key,
    body,
    leaseMs = 30000,
    timeoutMs = 30000,
    handler,
  } = options;

  const digest = computeCanonicalDigest(method, route, body);
  const storageKey = hashIdempotencyKey(actor, method, route, key);

  let acquireResult = await repository.acquireIdempotencyRecord(storageKey, leaseMs);

  // If already in progress, wait for the leader operation to finish
  if (acquireResult.status === "in_progress") {
    try {
      const completedRecord = await waitForIdempotencyCompletion(repository, storageKey, timeoutMs);
      acquireResult = { status: "completed", record: completedRecord };
    } catch {
      // Lease expired or wait timed out; attempt re-acquire lock for recovery
      acquireResult = await repository.acquireIdempotencyRecord(storageKey, leaseMs);
    }
  }

  // Handle completed response replay & conflict verification
  if (acquireResult.status === "completed") {
    const record = acquireResult.record;

    // Check if key was reused with a different request digest
    if (record.digest && record.digest !== digest) {
      throw new ApiError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "Idempotency key has already been used with a different request.",
      );
    }

    return {
      isReplay: true,
      status: record.status,
      body: record.body as T,
      record,
    };
  }

  // Lock acquired: execute operation handler
  const response = await handler();

  await recordIdempotency(repository, actor, key, response.status, response.body, {
    actor,
    method,
    route,
    key,
    digest,
  });

  const completedRecord: IdempotencyRecord & { state: "completed" } = {
    state: "completed",
    status: response.status,
    body: response.body,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    actor,
    method,
    route,
    key,
    digest,
  };

  return {
    isReplay: false,
    status: response.status,
    body: response.body,
    record: completedRecord,
  };
}
