import { createHash } from "node:crypto";
import type { ApiRepository } from "./repository";
import type { IdempotencyRecord } from "./domain";

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
  config?: IdempotencyConfig,
): Promise<void> {
  const keyHash = hashIdempotencyKey(actor, rawKey);
  const ttlSeconds = getIdempotencyTtlSeconds(config);
  const createdAtDate = new Date();
  const expiresAtDate = new Date(createdAtDate.getTime() + ttlSeconds * 1000);

  const record: IdempotencyRecord = {
    status,
    body,
    createdAt: createdAtDate.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
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
