import { createHash } from "node:crypto";
import type { ApiRepository } from "./repository";
import type { IdempotencyRecord } from "./domain";
import { canonicalize } from "./envelope";

<<<<<<< HEAD
export interface IdempotencyConfig {
  ttlSeconds?: number;
}

export interface CleanupMetrics {
  purgedCount: number;
  durationMs: number;
  activeSkippedCount: number;
}

export function getIdempotencyTtlSeconds(config?: IdempotencyConfig): number {
  if (config?.ttlSeconds !== undefined) return config.ttlSeconds;
  const envVal = process.env.IDEMPOTENCY_TTL_SECONDS;
  return envVal ? parseInt(envVal, 10) : 86400; // default 24 hours
}

export function hashIdempotencyKey(actor: string, rawKey: string): string {
  return createHash("sha256").update(`${actor}:${rawKey}`).digest("hex");
=======
/**
 * Issue #1501: canonicalize request bodies before computing idempotency
 * digests so semantically identical JSON (different key order) hashes the same,
 * while genuinely different values still conflict. Array order, numeric/string
 * distinctions, and the actor scope all remain significant.
 */
export function hashIdempotencyKey(actor: string, rawKey: unknown): string {
  const canonical = canonicalize(rawKey);
  return createHash("sha256").update(`${actor}:${canonical}`).digest("hex");
>>>>>>> upstream/main
}

export async function acquireIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  leaseMs: number = 30000, // default 30s lease
): Promise<import("./repository").AcquireIdempotencyResult> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  return repository.acquireIdempotencyRecord(keyHash, leaseMs);
}

// Restored to fix CI compatibility with imports that still use checkIdempotency
export async function checkIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
): Promise<IdempotencyRecord | null> {
  const result = await acquireIdempotency(repository, actor, rawKey);
  if (result.status === "completed") {
    return result.record;
  }
  return null;
}

export async function recordIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  status: number,
  body: unknown,
  config?: IdempotencyConfig,
): Promise<void> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
<<<<<<< HEAD
  const ttlSeconds = getIdempotencyTtlSeconds(config);
  const createdAtDate = new Date();
  const expiresAtDate = new Date(createdAtDate.getTime() + ttlSeconds * 1000);
=======
  const now = new Date().toISOString();

  // Get the existing record to preserve the original createdAt, or fallback to now
  const existing = await repository.getIdempotencyRecord(keyHash);
  const createdAt = existing ? existing.createdAt : now;
>>>>>>> upstream/main

  const record: IdempotencyRecord = {
    state: "completed",
    status,
    body,
<<<<<<< HEAD
    createdAt: createdAtDate.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
=======
    createdAt,
    completedAt: now,
>>>>>>> upstream/main
  };
  await repository.setIdempotencyRecord(keyHash, record);
}

export async function cleanupExpiredIdempotencyRecords(
  repository: ApiRepository,
  nowString: string = new Date().toISOString(),
): Promise<CleanupMetrics> {
  const startTime = Date.now();

  const result = await repository.deleteExpiredIdempotencyRecords(nowString);
  const durationMs = Date.now() - startTime;

  const metrics: CleanupMetrics = {
    purgedCount: result.purgedCount,
    durationMs,
    activeSkippedCount: result.activeSkippedCount,
  };

  console.log(
    JSON.stringify({
      event: "idempotency_cleanup",
      metrics,
      timestamp: nowString,
    }),
  );

  return metrics;
}
