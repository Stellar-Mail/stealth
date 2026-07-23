import type { ZodSchema } from "zod";
import type {
  IdempotencyRecord,
  MailboxPolicy,
  Postage,
  PostageStatus,
  Receipt,
  SenderRule,
} from "./domain";
import { ApiError, DataIntegrityError, RetryExhaustedError } from "./errors";

/**
 * Outcome of an atomic compare-and-swap postage state transition.
 *
 * - "not-found": no postage record exists for the given messageId.
 * - "conflict": the postage exists but its current status did not match the
 *   expected status, so no transition was applied. `postage` reflects the
 *   actual current record so callers can build a deterministic error.
 * - "applied": the transition was applied atomically. `postage` reflects the
 *   updated record.
 */
export type PostageTransitionResult =
  | { outcome: "not-found" }
  | { outcome: "conflict"; postage: Postage }
  | { outcome: "applied"; postage: Postage };

export type AcquireIdempotencyResult =
  | { status: "acquired" }
  | { status: "in_progress" }
  | { status: "completed"; record: IdempotencyRecord & { state: "completed" } };

/**
 * Outcome of an atomic read-receipt publication.
 *
 * - "not-found": no receipt record exists for the given messageId.
 * - "forbidden": the requesting actor is not a participant in the receipt
 *   (neither sender nor recipient). The read state is never modified.
 * - "already-read": the receipt was already marked as read on a prior call.
 *   `readAt` reflects the original timestamp recorded on the first valid
 *   transition, enabling callers to surface deterministic 409 responses
 *   without a separate read round-trip.
 * - "marked": the read timestamp was set atomically for the first time.
 *   `receipt` reflects the updated record.
 *
 * ## Duplicate-call policy
 *
 * The first caller that observes `readAt === null` wins; every subsequent
 * call receives `{ outcome: "already-read", readAt }`. This is a
 * first-write-wins, idempotent-read policy: the stored timestamp is
 * authoritative and is never overwritten.
 */
export type MarkReceiptReadResult =
  | { outcome: "not-found" }
  | { outcome: "forbidden" }
  | { outcome: "already-read"; readAt: string }
  | { outcome: "marked"; receipt: Receipt };

export interface ApiRepository {
  getPolicy(owner: string): Promise<MailboxPolicy | null>;
  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy>;
  getSenderRule(owner: string, sender: string): Promise<SenderRule>;
  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule>;
  getPostage(messageId: string): Promise<Postage | null>;
  setPostage(postage: Postage): Promise<Postage>;
  /**
   * Atomically transitions a postage record from `expectedStatus` to
   * `nextStatus`. Implementations MUST guarantee that concurrent callers
   * racing on the same messageId observe a single winner: exactly one call
   * receives `{ outcome: "applied" }` and every other concurrent/subsequent
   * call receives `{ outcome: "conflict" }` reflecting the terminal state.
   * This must not be implemented as a plain get-then-set, since that is
   * vulnerable to double-settlement under concurrent requests.
   */
  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult>;
  /**
   * Insert a postage record, enforcing message-identifier uniqueness at the
   * persistence layer. Unlike {@link ApiRepository.setPostage} (an upsert), a
   * duplicate messageId must reject with a deterministic conflict
   * (ApiError 409 "conflict") so duplicate records can never create ambiguous
   * postage/receipt state. Concurrent inserts must yield exactly one winner.
   */
  insertPostage(postage: Postage): Promise<Postage>;
  getReceipt(messageId: string): Promise<Receipt | null>;
  setReceipt(receipt: Receipt): Promise<Receipt>;
  createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }>;
  markReceiptRead(messageId: string, actor: string, now?: Date): Promise<MarkReceiptReadResult>;
  acquireIdempotencyRecord(key: string, leaseMs: number): Promise<AcquireIdempotencyResult>;
  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void>;

  getRelayQueueDepth(relayId: string): Promise<number>;
  getRelayRetryCount(relayId: string): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string): Promise<number>;
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number>;
  reset?(): void;
}

export const defaultMailboxPolicy: MailboxPolicy = {
  allowUnknown: false,
  minimumPostage: "0",
  requireVerified: true,
};

// ---------------------------------------------------------------------------
// Issue #1508: Record validation at adapter boundaries
// ---------------------------------------------------------------------------

let correlationCounter = 0;

export function generateCorrelationId(): string {
  correlationCounter += 1;
  return `di-${Date.now()}-${correlationCounter}`;
}

const recordSchemas = new Map<string, ZodSchema>();

export function registerRecordSchema(type: string, schema: ZodSchema): void {
  recordSchemas.set(type, schema);
}

export function validateRecord<T>(recordType: string, data: unknown): T {
  const schema = recordSchemas.get(recordType);
  if (!schema) return data as T;
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new DataIntegrityError(
      recordType,
      generateCorrelationId(),
      `Stored ${recordType} record failed validation`,
    );
  }
  return result.data as T;
}

/**
 * Wraps any ApiRepository to validate records at adapter boundaries.
 * Corrupt records throw a DataIntegrityError that never leaks the
 * corrupt payload to clients — only the record type and correlation ID
 * are exposed.
 */
export class ValidatedApiRepository implements ApiRepository {
  constructor(private readonly inner: ApiRepository) {}

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const raw = await this.inner.getPolicy(owner);
    return raw ? validateRecord<MailboxPolicy>("mailboxPolicy", raw) : null;
  }

  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    return this.inner.setPolicy(owner, policy);
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const raw = await this.inner.getSenderRule(owner, sender);
    return validateRecord<SenderRule>("senderRule", raw);
  }

  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    return this.inner.setSenderRule(owner, sender, rule);
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const raw = await this.inner.getPostage(messageId);
    return raw ? validateRecord<Postage>("postage", raw) : null;
  }

  setPostage(postage: Postage): Promise<Postage> {
    return this.inner.setPostage(postage);
  }

  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    return this.inner.transitionPostage(messageId, expectedStatus, nextStatus);
  }

  async insertPostage(postage: Postage): Promise<Postage> {
    const result = await this.inner.insertPostage(postage);
    return validateRecord<Postage>("postage", result);
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const raw = await this.inner.getReceipt(messageId);
    return raw ? validateRecord<Receipt>("receipt", raw) : null;
  }

  setReceipt(receipt: Receipt): Promise<Receipt> {
    return this.inner.setReceipt(receipt);
  }

  createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    return this.inner.createReceiptIfAbsent(receipt);
  }

  markReceiptRead(messageId: string, actor: string, now?: Date): Promise<MarkReceiptReadResult> {
    return this.inner.markReceiptRead(messageId, actor, now);
  }

  acquireIdempotencyRecord(key: string, leaseMs: number): Promise<AcquireIdempotencyResult> {
    return this.inner.acquireIdempotencyRecord(key, leaseMs);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.inner.getIdempotencyRecord(key);
    return raw ? validateRecord<IdempotencyRecord>("idempotencyRecord", raw) : null;
  }

  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    return this.inner.setIdempotencyRecord(key, record);
  }

  getRelayQueueDepth(relayId: string): Promise<number> {
    return this.inner.getRelayQueueDepth(relayId);
  }

  getRelayRetryCount(relayId: string): Promise<number> {
    return this.inner.getRelayRetryCount(relayId);
  }

  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null> {
    return this.inner.getRelayLastSuccessfulDelivery(relayId);
  }

  getRelayLastFailedDelivery(relayId: string): Promise<string | null> {
    return this.inner.getRelayLastFailedDelivery(relayId);
  }

  getRelayDeadLetterCount(relayId: string): Promise<number> {
    return this.inner.getRelayDeadLetterCount(relayId);
  }

  getCounter(key: string): Promise<number> {
    return this.inner.getCounter(key);
  }

  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number> {
    return this.inner.incrementCounter(key, windowSeconds, amount);
  }

  reset(): void {
    this.inner.reset?.();
  }
}

// ---------------------------------------------------------------------------
// Bounded retry policy for repository operations
// ---------------------------------------------------------------------------

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 200,
};

const RETRY_SAFE_OPERATIONS = new Set<string>([
  "getPolicy",
  "getSenderRule",
  "getPostage",
  "getReceipt",
  "getIdempotencyRecord",
  "getRelayQueueDepth",
  "getRelayRetryCount",
  "getRelayLastSuccessfulDelivery",
  "getRelayLastFailedDelivery",
  "getRelayDeadLetterCount",
  "getCounter",
  "setPolicy",
  "setSenderRule",
  "setPostage",
  "setReceipt",
  "createReceiptIfAbsent",
  "markReceiptRead",
  "setIdempotencyRecord",
  "transitionPostage",
  "markReceiptRead",
]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) return error.retryable;
  return true;
}

function calculateBackoff(attempt: number, policy: RetryPolicy): number {
  const exponentialDelay = policy.baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * policy.baseDelayMs * 0.5;
  return exponentialDelay + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps any ApiRepository with a bounded retry policy.
 *
 * Only operations classified as retry-safe are retried automatically.
 * Unsafe writes (insertPostage, acquireIdempotencyRecord, incrementCounter,
 * reset) are never retried. Retries use exponential backoff with jitter.
 * On exhaustion, a stable {@link RetryExhaustedError} is thrown.
 */
export class RetryableApiRepository implements ApiRepository {
  private readonly inner: ApiRepository;
  private readonly policy: RetryPolicy;

  constructor(inner: ApiRepository, policy: RetryPolicy = DEFAULT_RETRY_POLICY) {
    this.inner = inner;
    this.policy = policy;
  }

  private async withRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    if (!RETRY_SAFE_OPERATIONS.has(operation)) {
      return fn();
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.policy.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (!isRetryableError(error)) {
          throw error;
        }
        if (attempt < this.policy.maxAttempts) {
          await sleep(calculateBackoff(attempt, this.policy));
        }
      }
    }
    throw new RetryExhaustedError(lastError);
  }

  getPolicy(owner: string): Promise<MailboxPolicy | null> {
    return this.withRetry("getPolicy", () => this.inner.getPolicy(owner));
  }

  setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    return this.withRetry("setPolicy", () => this.inner.setPolicy(owner, policy));
  }

  getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    return this.withRetry("getSenderRule", () => this.inner.getSenderRule(owner, sender));
  }

  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    return this.withRetry("setSenderRule", () => this.inner.setSenderRule(owner, sender, rule));
  }

  getPostage(messageId: string): Promise<Postage | null> {
    return this.withRetry("getPostage", () => this.inner.getPostage(messageId));
  }

  setPostage(postage: Postage): Promise<Postage> {
    return this.withRetry("setPostage", () => this.inner.setPostage(postage));
  }

  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    return this.withRetry("transitionPostage", () =>
      this.inner.transitionPostage(messageId, expectedStatus, nextStatus),
    );
  }

  insertPostage(postage: Postage): Promise<Postage> {
    return this.inner.insertPostage(postage);
  }

  getReceipt(messageId: string): Promise<Receipt | null> {
    return this.withRetry("getReceipt", () => this.inner.getReceipt(messageId));
  }

  setReceipt(receipt: Receipt): Promise<Receipt> {
    return this.withRetry("setReceipt", () => this.inner.setReceipt(receipt));
  }

  createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    return this.withRetry("createReceiptIfAbsent", () => this.inner.createReceiptIfAbsent(receipt));
  }

  markReceiptRead(messageId: string, actor: string, now?: Date): Promise<MarkReceiptReadResult> {
    return this.withRetry("markReceiptRead", () =>
      this.inner.markReceiptRead(messageId, actor, now),
    );
  }

  acquireIdempotencyRecord(key: string, leaseMs: number): Promise<AcquireIdempotencyResult> {
    return this.inner.acquireIdempotencyRecord(key, leaseMs);
  }

  getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return this.withRetry("getIdempotencyRecord", () => this.inner.getIdempotencyRecord(key));
  }

  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    return this.withRetry("setIdempotencyRecord", () =>
      this.inner.setIdempotencyRecord(key, record),
    );
  }

  getRelayQueueDepth(relayId: string): Promise<number> {
    return this.withRetry("getRelayQueueDepth", () => this.inner.getRelayQueueDepth(relayId));
  }

  getRelayRetryCount(relayId: string): Promise<number> {
    return this.withRetry("getRelayRetryCount", () => this.inner.getRelayRetryCount(relayId));
  }

  getRelayLastSuccessfulDelivery(relayId: string): Promise<string | null> {
    return this.withRetry("getRelayLastSuccessfulDelivery", () =>
      this.inner.getRelayLastSuccessfulDelivery(relayId),
    );
  }

  getRelayLastFailedDelivery(relayId: string): Promise<string | null> {
    return this.withRetry("getRelayLastFailedDelivery", () =>
      this.inner.getRelayLastFailedDelivery(relayId),
    );
  }

  getRelayDeadLetterCount(relayId: string): Promise<number> {
    return this.withRetry("getRelayDeadLetterCount", () =>
      this.inner.getRelayDeadLetterCount(relayId),
    );
  }

  getCounter(key: string): Promise<number> {
    return this.withRetry("getCounter", () => this.inner.getCounter(key));
  }

  incrementCounter(key: string, windowSeconds: number, amount?: number): Promise<number> {
    return this.inner.incrementCounter(key, windowSeconds, amount);
  }

  reset(): void {
    this.inner.reset?.();
  }
}
