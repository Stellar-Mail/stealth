import { randomUUID } from "node:crypto";
import type {
  DeadLetter,
  DeadLetterStatus,
  DurableJob,
  DurableJobType,
  JobErrorCode,
  JobStatus,
  ReceiptCheckpoint,
  ReceiptEvent,
} from "./domain";
import { ApiError } from "./errors";
import type { ApiRepository } from "./repository";

// ---------------------------------------------------------------------------
// Error Taxonomy & Redaction
// ---------------------------------------------------------------------------

export const ERROR_TAXONOMY: Record<string, JobErrorCode> = {
  ERR_NETWORK_TRANSIENT: "ERR_NETWORK_TRANSIENT",
  ERR_RPC_TIMEOUT: "ERR_RPC_TIMEOUT",
  ERR_RATE_LIMITED: "ERR_RATE_LIMITED",
  ERR_INSUFFICIENT_FUNDS: "ERR_INSUFFICIENT_FUNDS",
  ERR_CONTRACT_REVERT: "ERR_CONTRACT_REVERT",
  ERR_DOMAIN_NOT_FOUND: "ERR_DOMAIN_NOT_FOUND",
  ERR_UNAUTHORIZED: "ERR_UNAUTHORIZED",
  ERR_PAYLOAD_REJECTED: "ERR_PAYLOAD_REJECTED",
  ERR_DELIVERY_EXPIRED: "ERR_DELIVERY_EXPIRED",
  ERR_POISON_PAYLOAD: "ERR_POISON_PAYLOAD",
  ERR_CHECKPOINT_GAP: "ERR_CHECKPOINT_GAP",
  ERR_UNKNOWN_PERMANENT: "ERR_UNKNOWN_PERMANENT",
};

/** Redacts sensitive tokens, private keys, secret keys, or seeds from error text. */
export function redactErrorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  // Redact Stellar S-seeds (S followed by 55 chars)
  message = message.replace(/S[A-Z2-7]{55}/g, "[REDACTED_SEED]");
  // Redact bearer tokens or authorization headers
  message = message.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, "Bearer [REDACTED_TOKEN]");
  // Redact hex private keys (64 char hex)
  message = message.replace(/(?:private|secret)[_-\s]?key["':\s]+[a-f0-9]{64}/gi, "[REDACTED_KEY]");
  // Bound the error length to prevent unbounded memory usage
  return message.slice(0, 300);
}

/** Classifies an error into a structured reason taxonomy code. */
export function classifyError(error: unknown): { code: JobErrorCode; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.code === "too_many_requests" || error.status === 429) {
      return { code: "ERR_RATE_LIMITED", retryable: true };
    }
    if (error.code === "unauthorized" || error.status === 401 || error.status === 403) {
      return { code: "ERR_UNAUTHORIZED", retryable: false };
    }
    if (error.code === "not_found" || error.status === 404) {
      return { code: "ERR_DOMAIN_NOT_FOUND", retryable: false };
    }
    if (error.status === 400 || error.status === 422) {
      return { code: "ERR_PAYLOAD_REJECTED", retryable: false };
    }
    if (error.retryable) {
      return { code: "ERR_NETWORK_TRANSIENT", retryable: true };
    }
  }

  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (msg.includes("timeout") || msg.includes("etimedout")) {
    return { code: "ERR_RPC_TIMEOUT", retryable: true };
  }
  if (msg.includes("rate limit") || msg.includes("429")) {
    return { code: "ERR_RATE_LIMITED", retryable: true };
  }
  if (msg.includes("insufficient") || msg.includes("underfunded")) {
    return { code: "ERR_INSUFFICIENT_FUNDS", retryable: false };
  }
  if (msg.includes("revert") || msg.includes("contract failed")) {
    return { code: "ERR_CONTRACT_REVERT", retryable: false };
  }
  if (msg.includes("domain not found") || msg.includes("enotfound")) {
    return { code: "ERR_DOMAIN_NOT_FOUND", retryable: false };
  }
  if (msg.includes("unauthorized") || msg.includes("forbidden")) {
    return { code: "ERR_UNAUTHORIZED", retryable: false };
  }
  if (msg.includes("expired") || msg.includes("ttl")) {
    return { code: "ERR_DELIVERY_EXPIRED", retryable: false };
  }
  if (msg.includes("poison") || msg.includes("malformed") || msg.includes("invalid payload")) {
    return { code: "ERR_POISON_PAYLOAD", retryable: false };
  }
  if (msg.includes("gap") || msg.includes("sequence")) {
    return { code: "ERR_CHECKPOINT_GAP", retryable: true };
  }

  return { code: "ERR_NETWORK_TRANSIENT", retryable: true };
}

// ---------------------------------------------------------------------------
// Backoff with Jitter
// ---------------------------------------------------------------------------

export function calculateBackoff(
  attempt: number,
  baseBackoffMs = 1000,
  maxBackoffMs = 60000,
  jitterRatio = 0.25,
): number {
  const cappedAttempt = Math.max(1, attempt);
  const exponential = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, cappedAttempt - 1));
  const jitter = Math.random() * exponential * jitterRatio;
  return Math.round(exponential + jitter);
}

// ---------------------------------------------------------------------------
// Job Lifecycle Operations
// ---------------------------------------------------------------------------

export interface EnqueueJobInput {
  jobId?: string;
  type: DurableJobType;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  backoffMs?: number;
  nextRunAt?: string;
  checkpoint?: string;
}

export async function enqueueDurableJob(
  repository: ApiRepository,
  input: EnqueueJobInput,
  now = new Date(),
): Promise<{ enqueued: boolean; job: DurableJob }> {
  const nowIso = now.toISOString();
  const job: DurableJob = {
    jobId: input.jobId ?? randomUUID(),
    type: input.type,
    idempotencyKey: input.idempotencyKey,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 5,
    backoffMs: input.backoffMs ?? 1000,
    nextRunAt: input.nextRunAt ?? nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    checkpoint: input.checkpoint,
  };

  return repository.enqueueJob(job);
}

export async function recordJobSuccess(
  repository: ApiRepository,
  job: DurableJob,
  checkpoint?: string,
  now = new Date(),
): Promise<DurableJob> {
  const nowIso = now.toISOString();
  const updated: DurableJob = {
    ...job,
    status: "completed",
    completedAt: nowIso,
    updatedAt: nowIso,
    checkpoint: checkpoint ?? job.checkpoint,
  };
  return repository.updateJob(updated);
}

export async function recordJobFailure(
  repository: ApiRepository,
  job: DurableJob,
  error: unknown,
  options: { forceNonRetryable?: boolean; now?: Date } = {},
): Promise<{ job: DurableJob; deadLetter?: DeadLetter }> {
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const classification = classifyError(error);
  const isRetryable = !options.forceNonRetryable && classification.retryable;
  const newAttempts = job.attempts + 1;
  const redactedMessage = redactErrorMessage(error);

  if (isRetryable && newAttempts < job.maxAttempts) {
    const delayMs = calculateBackoff(newAttempts, job.backoffMs);
    const nextRun = new Date(now.getTime() + delayMs).toISOString();

    const updatedJob: DurableJob = {
      ...job,
      attempts: newAttempts,
      status: "pending",
      nextRunAt: nextRun,
      updatedAt: nowIso,
      lastError: redactedMessage,
      errorCode: classification.code,
    };

    const saved = await repository.updateJob(updatedJob);
    return { job: saved };
  }

  // Exhausted or non-retryable -> Dead Letter Queue
  const updatedJob: DurableJob = {
    ...job,
    attempts: newAttempts,
    status: "dead_letter",
    failedAt: nowIso,
    updatedAt: nowIso,
    lastError: redactedMessage,
    errorCode: classification.code,
  };

  const savedJob = await repository.updateJob(updatedJob);

  const deadLetter: DeadLetter = {
    deadLetterId: randomUUID(),
    jobId: savedJob.jobId,
    jobType: savedJob.type,
    idempotencyKey: savedJob.idempotencyKey,
    payload: savedJob.payload,
    attempts: newAttempts,
    errorCode: classification.code,
    errorMessage: redactedMessage,
    deadLetteredAt: nowIso,
    status: "dead",
  };

  const savedDLQ = await repository.createDeadLetter(deadLetter);
  return { job: savedJob, deadLetter: savedDLQ };
}

// ---------------------------------------------------------------------------
// Dead Letter Queue Administrator Operations
// ---------------------------------------------------------------------------

export async function listDeadLetters(
  repository: ApiRepository,
  filter?: { jobType?: DurableJobType; status?: DeadLetterStatus; limit?: number },
): Promise<DeadLetter[]> {
  return repository.listDeadLetters(filter);
}

export async function getDeadLetter(
  repository: ApiRepository,
  deadLetterId: string,
): Promise<DeadLetter> {
  const dlq = await repository.getDeadLetter(deadLetterId);
  if (!dlq) {
    throw new ApiError(404, "not_found", `Dead letter record ${deadLetterId} was not found`);
  }
  return dlq;
}

export async function retryDeadLetter(
  repository: ApiRepository,
  deadLetterId: string,
  now = new Date(),
): Promise<{ deadLetter: DeadLetter; job: DurableJob }> {
  const dlq = await getDeadLetter(repository, deadLetterId);
  if (dlq.status === "retried") {
    const job = await repository.getJob(dlq.jobId);
    if (!job) throw new ApiError(404, "not_found", "Associated job not found");
    return { deadLetter: dlq, job };
  }

  const nowIso = now.toISOString();
  const updatedDLQ: DeadLetter = {
    ...dlq,
    status: "retried",
    retriedAt: nowIso,
  };

  await repository.updateDeadLetter(updatedDLQ);

  const existingJob = await repository.getJob(dlq.jobId);
  let job: DurableJob;
  if (existingJob) {
    job = await repository.updateJob({
      ...existingJob,
      status: "pending",
      attempts: 0,
      nextRunAt: nowIso,
      updatedAt: nowIso,
      lastError: undefined,
      errorCode: undefined,
    });
  } else {
    const res = await enqueueDurableJob(
      repository,
      {
        jobId: dlq.jobId,
        type: dlq.jobType,
        idempotencyKey: dlq.idempotencyKey,
        payload: dlq.payload,
        nextRunAt: nowIso,
      },
      now,
    );
    job = res.job;
  }

  return { deadLetter: updatedDLQ, job };
}

export async function abandonDeadLetter(
  repository: ApiRepository,
  deadLetterId: string,
  adminNotes?: string,
  now = new Date(),
): Promise<DeadLetter> {
  const dlq = await getDeadLetter(repository, deadLetterId);
  const nowIso = now.toISOString();

  const updatedDLQ: DeadLetter = {
    ...dlq,
    status: "abandoned",
    abandonedAt: nowIso,
    adminNotes: adminNotes ?? dlq.adminNotes,
  };

  const savedDLQ = await repository.updateDeadLetter(updatedDLQ);

  const existingJob = await repository.getJob(dlq.jobId);
  if (existingJob) {
    await repository.updateJob({
      ...existingJob,
      status: "abandoned",
      updatedAt: nowIso,
    });
  }

  return savedDLQ;
}

// ---------------------------------------------------------------------------
// Receipt Event Indexing with Checkpoints & Gap Detection
// ---------------------------------------------------------------------------

export interface IndexReceiptResult {
  indexedCount: number;
  duplicateCount: number;
  gapsDetected: number;
  checkpoint: ReceiptCheckpoint;
}

export async function indexReceiptEvents(
  repository: ApiRepository,
  streamId: string,
  events: ReceiptEvent[],
  now = new Date(),
): Promise<IndexReceiptResult> {
  const existingCheckpoint = await repository.getReceiptCheckpoint(streamId);
  const checkpoint: ReceiptCheckpoint = existingCheckpoint ?? {
    streamId,
    lastSequence: -1,
    processedCount: 0,
    lastIndexedAt: now.toISOString(),
    gapCount: 0,
  };

  let indexedCount = 0;
  let duplicateCount = 0;
  let gapsDetected = 0;

  // Sort events strictly by sequence ascending
  const sortedEvents = [...events].sort((a, b) => a.sequence - b.sequence);

  for (const event of sortedEvents) {
    // Duplicate suppression: sequence already <= lastSequence
    if (event.sequence <= checkpoint.lastSequence) {
      duplicateCount++;
      continue;
    }

    // Gap detection: sequence > lastSequence + 1
    if (event.sequence > checkpoint.lastSequence + 1) {
      gapsDetected += event.sequence - (checkpoint.lastSequence + 1);
    }

    // Create delivery receipt with duplicate safety
    await repository.createReceiptIfAbsent({
      messageId: event.messageId,
      recipient: event.recipient,
      sender: event.sender,
      deliveredAt: event.deliveredAt,
      readAt: event.readAt ?? null,
    });

    checkpoint.lastSequence = event.sequence;
    checkpoint.processedCount += 1;
    indexedCount++;
  }

  checkpoint.gapCount += gapsDetected;
  checkpoint.lastIndexedAt = now.toISOString();

  const savedCheckpoint = await repository.setReceiptCheckpoint(checkpoint);

  return {
    indexedCount,
    duplicateCount,
    gapsDetected,
    checkpoint: savedCheckpoint,
  };
}
