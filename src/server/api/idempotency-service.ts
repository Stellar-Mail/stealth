import { createHash } from "node:crypto";
import type { ApiRepository } from "./repository";
import type { IdempotencyRecord } from "./domain";
import { canonicalize } from "./envelope";

/**
 * Issue #1501: canonicalize request bodies before computing idempotency
 * digests so semantically identical JSON (different key order) hashes the same,
 * while genuinely different values still conflict. Array order, numeric/string
 * distinctions, and the actor scope all remain significant.
 */
export function hashIdempotencyKey(actor: string, rawKey: unknown): string {
  const canonical = canonicalize(rawKey);
  return createHash("sha256").update(`${actor}:${canonical}`).digest("hex");
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
): Promise<void> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  const now = new Date().toISOString();

  // Get the existing record to preserve the original createdAt, or fallback to now
  const existing = await repository.getIdempotencyRecord(keyHash);
  const createdAt = existing ? existing.createdAt : now;

  const record: IdempotencyRecord = {
    state: "completed",
    status,
    body,
    createdAt,
    completedAt: now,
  };
  await repository.setIdempotencyRecord(keyHash, record);
}
