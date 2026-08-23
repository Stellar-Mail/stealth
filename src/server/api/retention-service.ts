import type { ApiRepository } from "./repository";
import type { ObjectStoreAdapter } from "@/services/storage/object-store";

export const DEFAULT_RETENTION_POLICY = {
  failedJobMs: 7 * 24 * 60 * 60 * 1000,
  deadLetterMs: 30 * 24 * 60 * 60 * 1000,
} as const;

export async function enforceRetention(
  repository: ApiRepository,
  objectStore: ObjectStoreAdapter | null,
  now = new Date(),
  policy = DEFAULT_RETENTION_POLICY,
) {
  const failedJobs = await repository.listJobs({ status: "failed", limit: 1000 });
  const expiredJobs = failedJobs.filter(
    (job) => now.getTime() - new Date(job.updatedAt).getTime() >= policy.failedJobMs,
  );
  for (const job of expiredJobs) {
    await repository.updateJob({
      ...job,
      status: "abandoned",
      updatedAt: now.toISOString(),
    });
  }

  const deadLetters = await repository.listDeadLetters({ status: "dead", limit: 1000 });
  const expiredDeadLetters = deadLetters.filter(
    (deadLetter) =>
      now.getTime() - new Date(deadLetter.deadLetteredAt).getTime() >= policy.deadLetterMs,
  );
  for (const deadLetter of expiredDeadLetters) {
    await repository.updateDeadLetter({
      ...deadLetter,
      status: "abandoned",
      abandonedAt: now.toISOString(),
    });
  }

  const expiredObjects = objectStore ? await objectStore.cleanupExpired(now) : 0;
  return {
    expiredObjects,
    abandonedJobs: expiredJobs.length,
    abandonedDeadLetters: expiredDeadLetters.length,
  };
}
