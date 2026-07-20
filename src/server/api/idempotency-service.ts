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

export async function checkIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
): Promise<IdempotencyRecord | null> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  return repository.getIdempotencyRecord(keyHash);
}

export async function recordIdempotency(
  repository: ApiRepository,
  actor: string,
  rawKey: string,
  status: number,
  body: unknown,
): Promise<void> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  const record: IdempotencyRecord = {
    status,
    body,
    createdAt: new Date().toISOString(),
  };
  await repository.setIdempotencyRecord(keyHash, record);
}
