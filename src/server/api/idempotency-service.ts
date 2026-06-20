import { createHash } from "node:crypto";
import type { ApiRepository } from "./repository";
import type { IdempotencyRecord } from "./domain";

export function hashIdempotencyKey(actor: string, rawKey: string): string {
  return createHash("sha256").update(`${actor}:${rawKey}`).digest("hex");
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
  response: unknown,
): Promise<void> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  const record: IdempotencyRecord = {
    status,
    response,
    timestamp: Date.now(),
  };
  await repository.setIdempotencyRecord(keyHash, record);
}
