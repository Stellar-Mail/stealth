import type { ZodSchema } from "zod";
import type {
  IdempotencyRecord,
  MailboxPolicy,
  Postage,
  PostageStatus,
  Receipt,
  SenderRule,
} from "./domain";
import { DataIntegrityError } from "./errors";

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

export interface AbortOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class TimeoutError extends Error {
  readonly retryable = true;
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class CancelledError extends Error {
  readonly retryable = true;
  constructor(message = "Operation was cancelled") {
    super(message);
    this.name = "CancelledError";
  }
}

export interface ApiRepository {
  getPolicy(owner: string, opts?: AbortOptions): Promise<MailboxPolicy | null>;
  setPolicy(owner: string, policy: MailboxPolicy, opts?: AbortOptions): Promise<MailboxPolicy>;
  getSenderRule(owner: string, sender: string, opts?: AbortOptions): Promise<SenderRule>;
  setSenderRule(owner: string, sender: string, rule: SenderRule, opts?: AbortOptions): Promise<SenderRule>;
  getPostage(messageId: string, opts?: AbortOptions): Promise<Postage | null>;
  setPostage(postage: Postage, opts?: AbortOptions): Promise<Postage>;
  transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
    opts?: AbortOptions,
  ): Promise<PostageTransitionResult>;
  getReceipt(messageId: string, opts?: AbortOptions): Promise<Receipt | null>;
  setReceipt(receipt: Receipt, opts?: AbortOptions): Promise<Receipt>;
  acquireIdempotencyRecord(key: string, leaseMs: number, opts?: AbortOptions): Promise<AcquireIdempotencyResult>;
  getIdempotencyRecord(key: string, opts?: AbortOptions): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord, opts?: AbortOptions): Promise<void>;
  getRelayQueueDepth(relayId: string, opts?: AbortOptions): Promise<number>;
  getRelayRetryCount(relayId: string, opts?: AbortOptions): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string, opts?: AbortOptions): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string, opts?: AbortOptions): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string, opts?: AbortOptions): Promise<number>;
  getCounter(key: string, opts?: AbortOptions): Promise<number>;
  incrementCounter(key: string, windowSeconds: number, amount?: number, opts?: AbortOptions): Promise<number>;
  reset?(): void;
}

export function withTimeout<T>(promise: Promise<T>, opts?: AbortOptions): Promise<T> {
  if (!opts?.timeoutMs && !opts?.signal) return promise;

  return new Promise<T>((resolve, reject) => {
    const timeout = opts.timeoutMs
      ? setTimeout(() => reject(new TimeoutError()), opts.timeoutMs)
      : undefined;

    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timeout);
        reject(new CancelledError());
        return;
      }
      opts.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new CancelledError());
      }, { once: true });
    }

    promise.then(
      (value) => { clearTimeout(timeout); resolve(value); },
      (err) => { clearTimeout(timeout); reject(err); },
    );
  });
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

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const raw = await this.inner.getReceipt(messageId);
    return raw ? validateRecord<Receipt>("receipt", raw) : null;
  }

  setReceipt(receipt: Receipt): Promise<Receipt> {
    return this.inner.setReceipt(receipt);
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