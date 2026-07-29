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

export type Migration = (data: any) => any;

interface RecordSchemaDef {
  currentVersion: number;
  schema: ZodSchema;
  migrations: Record<number, Migration>;
}

const recordSchemas = new Map<string, RecordSchemaDef>();

export function registerRecordSchema(
  type: string,
  currentVersion: number,
  schema: ZodSchema,
  migrations: Record<number, Migration> = {},
): void {
  recordSchemas.set(type, { currentVersion, schema, migrations });
}

export function validateRecord<T>(recordType: string, data: unknown): T {
  const def = recordSchemas.get(recordType);
  if (!def) return data as T;

  const version =
    typeof data === "object" && data !== null && "$v" in data ? ((data as any).$v as number) : 1;

  if (version > def.currentVersion) {
    throw new DataIntegrityError(
      recordType,
      generateCorrelationId(),
      `Unsupported newer schema version ${version} for ${recordType}`,
    );
  }

  let migratedData = data;
  for (let v = version; v < def.currentVersion; v++) {
    const migration = def.migrations[v];
    if (migration) {
      migratedData = migration(migratedData);
      if (typeof migratedData === "object" && migratedData !== null) {
        (migratedData as any).$v = v + 1;
      }
    } else {
      throw new DataIntegrityError(
        recordType,
        generateCorrelationId(),
        `Missing migration from version ${v} to ${v + 1} for ${recordType}`,
      );
    }
  }

  const result = def.schema.safeParse(migratedData);
  if (!result.success) {
    throw new DataIntegrityError(
      recordType,
      generateCorrelationId(),
      `Stored ${recordType} record failed validation`,
    );
  }
  return result.data as T;
}

export function versionRecord<T>(recordType: string, data: T): T {
  const def = recordSchemas.get(recordType);
  if (!def || typeof data !== "object" || data === null) return data;
  return { ...data, $v: def.currentVersion } as unknown as T;
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
    return this.inner.setPolicy(owner, versionRecord("mailboxPolicy", policy));
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const raw = await this.inner.getSenderRule(owner, sender);
    return validateRecord<SenderRule>("senderRule", raw);
  }

  setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    return this.inner.setSenderRule(owner, sender, versionRecord("senderRule", rule));
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const raw = await this.inner.getPostage(messageId);
    return raw ? validateRecord<Postage>("postage", raw) : null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    const result = await this.inner.setPostage(versionRecord("postage", postage));
    return validateRecord<Postage>("postage", result);
  }

  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    const result = await this.inner.transitionPostage(messageId, expectedStatus, nextStatus);
    if (result.outcome === "conflict" || result.outcome === "applied") {
      result.postage = validateRecord<Postage>("postage", result.postage);
    }
    return result;
  }

  async insertPostage(postage: Postage): Promise<Postage> {
    const result = await this.inner.insertPostage(versionRecord("postage", postage));
    return validateRecord<Postage>("postage", result);
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const raw = await this.inner.getReceipt(messageId);
    return raw ? validateRecord<Receipt>("receipt", raw) : null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    const result = await this.inner.setReceipt(versionRecord("receipt", receipt));
    return validateRecord<Receipt>("receipt", result);
  }

  async createReceiptIfAbsent(receipt: Receipt): Promise<{ created: boolean; receipt: Receipt }> {
    const result = await this.inner.createReceiptIfAbsent(versionRecord("receipt", receipt));
    if (result.created) {
      result.receipt = validateRecord<Receipt>("receipt", result.receipt);
    }
    return result;
  }

  async markReceiptRead(
    messageId: string,
    actor: string,
    now?: Date,
  ): Promise<MarkReceiptReadResult> {
    const result = await this.inner.markReceiptRead(messageId, actor, now);
    if (result.outcome === "marked") {
      result.receipt = validateRecord<Receipt>("receipt", result.receipt);
    }
    return result;
  }

  acquireIdempotencyRecord(key: string, leaseMs: number): Promise<AcquireIdempotencyResult> {
    // Acquire does not take an object payload to insert, it creates one internally.
    // The internal DO logic is responsible for its own fields.
    // For reads via this repo wrapper, we could validate the returned record.
    return this.inner.acquireIdempotencyRecord(key, leaseMs).then((result) => {
      if (result.status === "completed") {
        result.record = validateRecord<IdempotencyRecord & { state: "completed" }>(
          "idempotencyRecord",
          result.record,
        );
      }
      return result;
    });
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    const raw = await this.inner.getIdempotencyRecord(key);
    return raw ? validateRecord<IdempotencyRecord>("idempotencyRecord", raw) : null;
  }

  setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    return this.inner.setIdempotencyRecord(key, versionRecord("idempotencyRecord", record));
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

// ---------------------------------------------------------------------------
// Issue #1491: deterministic total ordering for paginated queries
// ---------------------------------------------------------------------------

/**
 * Cursor pagination is only safe over a *total* order. When two records can
 * compare equal, their relative position is left to storage-engine chance, so
 * a client walking pages can see the same record twice or never see it at all.
 * Every paginated repository method therefore declares its sort fields plus a
 * unique tie-breaker, and continuation positions carry the complete sort key
 * rather than just the primary value.
 *
 * The guarantees are documented in `docs/api/PAGINATION.md`.
 */

export type SortDirection = "asc" | "desc";

export interface SortKey<T> {
  readonly field: keyof T & string;
  readonly direction: SortDirection;
}

export interface OrderingSpec<T> {
  /**
   * Sort keys, most significant first. The final key is always the
   * tie-breaker, so the order is total.
   */
  readonly keys: readonly SortKey<T>[];
  /** Field that is unique across the collection. */
  readonly tieBreaker: keyof T & string;
}

/**
 * Declares the total order for a paginated query.
 *
 * `primaryKeys` are the meaningful sort fields, most significant first;
 * `tieBreaker` is a field that is unique across the collection and is appended
 * as the least significant key. The tie-breaker inherits the direction of the
 * last primary key, so a page walk never reverses direction mid-key.
 *
 * Throws when the declaration cannot produce a total order. Registered
 * orderings are declared at module scope, so a malformed one fails at startup
 * rather than silently returning non-deterministic pages.
 */
export function declareOrdering<T>(
  primaryKeys: readonly SortKey<T>[],
  tieBreaker: keyof T & string,
): OrderingSpec<T> {
  if (typeof tieBreaker !== "string" || tieBreaker.length === 0) {
    throw new RangeError("A paginated ordering requires a non-empty tie-breaker field");
  }

  const seen = new Set<string>();
  for (const key of primaryKeys) {
    if (typeof key.field !== "string" || key.field.length === 0) {
      throw new RangeError("A paginated ordering requires non-empty sort field names");
    }
    if (key.field === tieBreaker) {
      throw new RangeError(
        `Sort field "${key.field}" is already the tie-breaker and must not be declared twice`,
      );
    }
    if (seen.has(key.field)) {
      throw new RangeError(`Sort field "${key.field}" is declared more than once`);
    }
    seen.add(key.field);
  }

  const direction = primaryKeys.at(-1)?.direction ?? "asc";
  return {
    keys: [...primaryKeys, { field: tieBreaker, direction }],
    tieBreaker,
  };
}

/**
 * Total order over the value types these records store. Nullish values sort
 * after defined ones so an optional field cannot make two records compare
 * equal on a technicality; anything else is a programming error and throws
 * rather than silently degrading the order.
 */
function compareValues(left: unknown, right: unknown): number {
  const leftMissing = left === null || left === undefined;
  const rightMissing = right === null || right === undefined;
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0;
    return leftMissing ? 1 : -1;
  }

  if (typeof left === "string" && typeof right === "string") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "boolean" && typeof right === "boolean") {
    return left === right ? 0 : left ? 1 : -1;
  }

  throw new TypeError(
    `Sort values must be comparable scalars of the same type, received ${typeof left} and ${typeof right}`,
  );
}

function compareTuples<T>(
  left: readonly unknown[],
  right: readonly unknown[],
  spec: OrderingSpec<T>,
): number {
  for (let index = 0; index < spec.keys.length; index += 1) {
    const comparison = compareValues(left[index], right[index]);
    if (comparison !== 0) {
      return spec.keys[index].direction === "desc" ? -comparison : comparison;
    }
  }
  return 0;
}

function sortValuesOf<T>(spec: OrderingSpec<T>, record: T): unknown[] {
  return spec.keys.map((key) => (record as Record<string, unknown>)[key.field]);
}

/** Comparator implementing the declared total order. */
export function compareByOrdering<T>(spec: OrderingSpec<T>): (left: T, right: T) => number {
  return (left, right) => compareTuples(sortValuesOf(spec, left), sortValuesOf(spec, right), spec);
}

/** Returns a new array ordered by the declared total order. */
export function sortByOrdering<T>(records: readonly T[], spec: OrderingSpec<T>): T[] {
  return [...records].sort(compareByOrdering(spec));
}

/**
 * Serializes the **complete** continuation key: every declared sort value in
 * declaration order, including the tie-breaker. A cursor built from this names
 * an absolute position in the total order, so a tie on the primary field
 * cannot make the server resume at the wrong record.
 */
export function continuationKeyOf<T>(spec: OrderingSpec<T>, record: T): string {
  return JSON.stringify(sortValuesOf(spec, record));
}

/** Decodes a continuation key, rejecting one that does not match the ordering. */
export function parseContinuationKey<T>(spec: OrderingSpec<T>, key: string): unknown[] {
  let values: unknown;
  try {
    values = JSON.parse(key);
  } catch {
    throw new ApiError(400, "bad_request", "Invalid pagination continuation key");
  }
  if (!Array.isArray(values) || values.length !== spec.keys.length) {
    throw new ApiError(400, "bad_request", "Pagination continuation key does not match this query");
  }
  return values;
}

export interface PaginateOptions {
  /** Maximum number of records to return. */
  readonly limit: number;
  /** Continuation key of the last record on the previous page. */
  readonly after?: string;
}

export interface Page<T> {
  readonly items: T[];
  /** Continuation key for the next page, or null when the walk is complete. */
  readonly nextContinuationKey: string | null;
}

/**
 * Applies the declared ordering and returns one page, resuming strictly after
 * the supplied continuation position.
 *
 * Because that position is absolute rather than an offset, a record inserted
 * or deleted elsewhere in the collection between page fetches never shifts the
 * remaining pages: a record that exists unchanged for the whole walk is
 * returned exactly once.
 */
export function paginate<T>(
  records: readonly T[],
  spec: OrderingSpec<T>,
  options: PaginateOptions,
): Page<T> {
  if (!Number.isSafeInteger(options.limit) || options.limit < 1) {
    throw new RangeError("Pagination limit must be a positive integer");
  }

  const ordered = sortByOrdering(records, spec);
  let remaining = ordered;
  if (options.after !== undefined) {
    const after = parseContinuationKey(spec, options.after);
    remaining = ordered.filter(
      (record) => compareTuples(sortValuesOf(spec, record), after, spec) > 0,
    );
  }

  const items = remaining.slice(0, options.limit);
  const hasMore = remaining.length > items.length;
  const last = items.at(-1);

  return {
    items,
    nextContinuationKey: hasMore && last !== undefined ? continuationKeyOf(spec, last) : null,
  };
}

/**
 * Declared ordering for every paginated repository method, keyed by method
 * name. A paginated method resolves its ordering through
 * {@link orderingForPaginatedMethod}, so it cannot ship without one.
 */
export const PAGINATED_QUERY_ORDERINGS = {
  listPostage: declareOrdering<Postage>([{ field: "createdAt", direction: "desc" }], "messageId"),
  listReceipts: declareOrdering<Receipt>(
    [{ field: "deliveredAt", direction: "desc" }],
    "messageId",
  ),
} as const;

export type PaginatedQueryName = keyof typeof PAGINATED_QUERY_ORDERINGS;

/** Resolves a declared ordering, failing loudly when a method has none. */
export function orderingForPaginatedMethod<T>(method: string): OrderingSpec<T> {
  const spec = (PAGINATED_QUERY_ORDERINGS as Record<string, OrderingSpec<unknown>>)[method];
  if (!spec) {
    throw new Error(
      `Paginated repository method "${method}" has no declared ordering. ` +
        "Add one to PAGINATED_QUERY_ORDERINGS with declareOrdering().",
    );
  }
  return spec as OrderingSpec<T>;
}
