import { createHash, randomUUID } from "node:crypto";

import {
  canTransitionDeliveryState,
  classifySmtpReplyCode,
  type DeliveryReasonClass,
  type DeliveryState,
  isTerminalDeliveryState,
  shouldRetainSendCallback,
} from "./delivery-status";
import { recipientDomain, redactNotificationText } from "./redaction";

/**
 * BETA-091: In-process verification-mail queue with exponential backoff and DLQ.
 *
 * Payloads never store plaintext tokens or full verification URLs. Send callbacks
 * are retained only while a message is still retryable; terminal outcomes purge
 * them immediately so secrets cannot linger for the isolate lifetime.
 * Idempotency is keyed by `messageId`.
 */

export interface DeliveryRecord {
  messageId: string;
  purpose: "email_verification" | "password_reset" | "beta_invite";
  /** Recipient domain only — never the local-part. */
  recipientDomain: string;
  /** SHA-256 hash of the normalized email for correlation without enumeration. */
  recipientHash: string;
  state: DeliveryState;
  reasonClass: DeliveryReasonClass;
  providerEventId?: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
  lastErrorClass?: string;
  deadLetteredAt?: string;
}

export interface EnqueueDeliveryInput {
  messageId?: string;
  purpose: DeliveryRecord["purpose"];
  recipientEmail: string;
  maxAttempts?: number;
}

export interface ProviderBounceEvent {
  messageId: string;
  eventType:
    | "delivered"
    | "deferred"
    | "soft_bounce"
    | "hard_bounce"
    | "rejected"
    | "complaint"
    | "unsubscribed";
  providerEventId?: string;
  /** Free-form provider text — redacted before persistence. */
  rawReason?: string;
  occurredAt?: Date;
}

export interface VerificationMailQueueOptions {
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  defaultMaxAttempts?: number;
  now?: () => Date;
}

export type QueuedSendFn = (record: DeliveryRecord) => Promise<{
  accepted: boolean;
  providerRef?: string;
  smtpCode?: number;
  error?: unknown;
}>;

function hashRecipient(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function calculateBackoff(attempt: number, baseMs: number, maxMs: number): number {
  const capped = Math.max(1, attempt);
  const exponential = Math.min(maxMs, baseMs * Math.pow(2, capped - 1));
  const jitter = Math.floor(Math.random() * exponential * 0.25);
  return exponential + jitter;
}

export class VerificationMailQueue {
  private readonly records = new Map<string, DeliveryRecord>();
  private readonly deadLetters: DeliveryRecord[] = [];
  /** Retained only while the message is still retryable — never after terminal. */
  private readonly sendFns = new Map<string, QueuedSendFn>();
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly defaultMaxAttempts: number;
  private readonly now: () => Date;
  private rateWindowStartMs = 0;
  private rateWindowCount = 0;

  constructor(options: VerificationMailQueueOptions = {}) {
    this.baseBackoffMs = options.baseBackoffMs ?? 1_000;
    this.maxBackoffMs = options.maxBackoffMs ?? 60_000;
    this.defaultMaxAttempts = options.defaultMaxAttempts ?? 5;
    this.now = options.now ?? (() => new Date());
  }

  /** Idempotent enqueue: same messageId returns the existing record. */
  enqueue(input: EnqueueDeliveryInput, send?: QueuedSendFn): DeliveryRecord {
    const messageId = input.messageId ?? `vm_${randomUUID().replace(/-/g, "")}`;
    const existing = this.records.get(messageId);
    if (existing) {
      if (send && shouldRetainSendCallback(existing.state)) {
        this.sendFns.set(messageId, send);
      }
      return { ...existing };
    }

    const createdAt = this.now().toISOString();
    const record: DeliveryRecord = {
      messageId,
      purpose: input.purpose,
      recipientDomain: recipientDomain(input.recipientEmail),
      recipientHash: hashRecipient(input.recipientEmail),
      state: "queued",
      reasonClass: "accepted_by_mta",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? this.defaultMaxAttempts,
      nextAttemptAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    this.records.set(messageId, record);
    if (send) this.sendFns.set(messageId, send);
    return { ...record };
  }

  /** True when a retry callback is still held (never for terminal messages). */
  hasRetryCallback(messageId: string): boolean {
    return this.sendFns.has(messageId);
  }

  get(messageId: string): DeliveryRecord | undefined {
    const record = this.records.get(messageId);
    return record ? { ...record } : undefined;
  }

  list(limit = 100): DeliveryRecord[] {
    return [...this.records.values()].slice(0, limit).map((record) => ({ ...record }));
  }

  deadLetterList(limit = 100): DeliveryRecord[] {
    return this.deadLetters.slice(0, limit).map((record) => ({ ...record }));
  }

  /** Queue lag: earliest nextAttempt among non-terminal records, in ms (0 if empty). */
  queueLagMs(): number {
    const nowMs = this.now().getTime();
    let oldestDue = Number.POSITIVE_INFINITY;
    for (const record of this.records.values()) {
      if (isTerminalDeliveryState(record.state)) continue;
      const due = Date.parse(record.nextAttemptAt);
      if (due < oldestDue) oldestDue = due;
    }
    if (!Number.isFinite(oldestDue)) return 0;
    return Math.max(0, nowMs - oldestDue);
  }

  /** Sends attempted in the current 60s window (observability only). */
  recentSendRate(): { windowSeconds: number; count: number } {
    this.pruneRateWindow();
    return { windowSeconds: 60, count: this.rateWindowCount };
  }

  /**
   * Process due jobs once. Retries are idempotent on messageId: a second claim
   * while already terminal is a no-op. Entries without a retry callback are
   * dead-lettered as poison (plaintext was purged; operator/user must resend).
   */
  async processDue(limit = 10): Promise<DeliveryRecord[]> {
    const nowMs = this.now().getTime();
    const due = [...this.records.values()]
      .filter(
        (record) =>
          !isTerminalDeliveryState(record.state) && Date.parse(record.nextAttemptAt) <= nowMs,
      )
      .slice(0, limit);

    const processed: DeliveryRecord[] = [];
    for (const record of due) {
      processed.push(await this.attempt(record.messageId));
    }
    return processed;
  }

  async attempt(messageId: string, sendOverride?: QueuedSendFn): Promise<DeliveryRecord> {
    const record = this.records.get(messageId);
    if (!record) {
      throw new Error(`Unknown verification-mail messageId`);
    }
    if (isTerminalDeliveryState(record.state) && record.state !== "failed") {
      this.purgeSendCallback(messageId);
      return { ...record };
    }

    const send = sendOverride ?? this.sendFns.get(messageId);
    if (sendOverride && shouldRetainSendCallback(record.state)) {
      this.sendFns.set(messageId, sendOverride);
    }
    if (!send) {
      return this.deadLetter(messageId, "failed", "poison_payload", "missing_send_fn");
    }

    record.attempts += 1;
    record.updatedAt = this.now().toISOString();
    this.bumpRate();

    let result: Awaited<ReturnType<QueuedSendFn>>;
    try {
      result = await send(record);
    } catch (error) {
      return this.handleFailure(record, error);
    }

    if (typeof result.smtpCode === "number") {
      const classified = classifySmtpReplyCode(result.smtpCode);
      if (classified.state === "accepted" || result.accepted) {
        return this.transition(messageId, "sent", "accepted_by_mta", undefined, result.providerRef);
      }
      if (!classified.retryable) {
        return this.deadLetter(messageId, classified.state, classified.reasonClass);
      }
      return this.scheduleRetry(messageId, classified.state, classified.reasonClass);
    }

    if (result.accepted) {
      return this.transition(messageId, "sent", "accepted_by_mta", undefined, result.providerRef);
    }
    return this.handleFailure(record, result.error ?? new Error("delivery_rejected"));
  }

  /** Apply a provider DSN / bounce webhook without echoing raw mailbox text. */
  applyProviderEvent(event: ProviderBounceEvent): DeliveryRecord | undefined {
    const record = this.records.get(event.messageId);
    if (!record) return undefined;

    const nextState = event.eventType as DeliveryState;
    if (!canTransitionDeliveryState(record.state, nextState)) {
      return { ...record };
    }

    const reasonClass: DeliveryReasonClass =
      event.eventType === "delivered"
        ? "accepted_by_mta"
        : event.eventType === "deferred"
          ? "transient_mailbox"
          : event.eventType === "soft_bounce"
            ? "soft_bounce"
            : event.eventType === "hard_bounce"
              ? "hard_bounce"
              : event.eventType === "complaint"
                ? "complaint"
                : event.eventType === "unsubscribed"
                  ? "unsubscribed"
                  : "permanent_reject";

    const updated = this.transition(
      event.messageId,
      nextState,
      reasonClass,
      event.rawReason ? redactNotificationText(event.rawReason) : undefined,
      event.providerEventId,
    );

    if (nextState === "hard_bounce" || nextState === "rejected" || nextState === "complaint") {
      return this.deadLetter(event.messageId, nextState, reasonClass);
    }
    if (!shouldRetainSendCallback(nextState)) {
      this.purgeSendCallback(event.messageId);
    }
    return updated;
  }

  resetForTesting(): void {
    this.records.clear();
    this.deadLetters.length = 0;
    this.sendFns.clear();
    this.rateWindowCount = 0;
    this.rateWindowStartMs = 0;
  }

  private purgeSendCallback(messageId: string): void {
    this.sendFns.delete(messageId);
  }

  private handleFailure(record: DeliveryRecord, error: unknown): DeliveryRecord {
    const redacted = redactNotificationText(error);
    const lower = redacted.toLowerCase();
    if (lower.includes("rate") || lower.includes("429")) {
      return this.scheduleRetry(record.messageId, "deferred", "rate_limited", redacted);
    }
    if (lower.includes("timeout") || lower.includes("econn") || lower.includes("network")) {
      return this.scheduleRetry(record.messageId, "deferred", "transient_network", redacted);
    }
    if (record.attempts >= record.maxAttempts) {
      return this.deadLetter(record.messageId, "failed", "unknown", redacted);
    }
    return this.scheduleRetry(record.messageId, "deferred", "transient_network", redacted);
  }

  private scheduleRetry(
    messageId: string,
    state: DeliveryState,
    reasonClass: DeliveryReasonClass,
    lastErrorClass?: string,
  ): DeliveryRecord {
    const record = this.records.get(messageId)!;
    if (record.attempts >= record.maxAttempts) {
      return this.deadLetter(messageId, "failed", reasonClass, lastErrorClass);
    }
    const delay = calculateBackoff(record.attempts, this.baseBackoffMs, this.maxBackoffMs);
    record.state = state;
    record.reasonClass = reasonClass;
    record.lastErrorClass = lastErrorClass?.slice(0, 120);
    record.nextAttemptAt = new Date(this.now().getTime() + delay).toISOString();
    record.updatedAt = this.now().toISOString();
    // Retryable only: send callback may remain until success, DLQ, or poison purge.
    return { ...record };
  }

  private deadLetter(
    messageId: string,
    state: DeliveryState,
    reasonClass: DeliveryReasonClass,
    lastErrorClass?: string,
  ): DeliveryRecord {
    const record = this.records.get(messageId)!;
    record.state = state;
    record.reasonClass = reasonClass;
    record.lastErrorClass = lastErrorClass?.slice(0, 120);
    record.deadLetteredAt = this.now().toISOString();
    record.updatedAt = record.deadLetteredAt;
    this.purgeSendCallback(messageId);
    this.deadLetters.push({ ...record });
    return { ...record };
  }

  private transition(
    messageId: string,
    state: DeliveryState,
    reasonClass: DeliveryReasonClass,
    lastErrorClass?: string,
    providerEventId?: string,
  ): DeliveryRecord {
    const record = this.records.get(messageId)!;
    if (!canTransitionDeliveryState(record.state, state) && record.state !== state) {
      return { ...record };
    }
    record.state = state;
    record.reasonClass = reasonClass;
    if (lastErrorClass) record.lastErrorClass = lastErrorClass.slice(0, 120);
    if (providerEventId) record.providerEventId = providerEventId;
    record.updatedAt = this.now().toISOString();
    if (!shouldRetainSendCallback(state)) {
      this.purgeSendCallback(messageId);
    }
    return { ...record };
  }

  private bumpRate(): void {
    this.pruneRateWindow();
    this.rateWindowCount += 1;
  }

  private pruneRateWindow(): void {
    const nowMs = this.now().getTime();
    if (nowMs - this.rateWindowStartMs >= 60_000) {
      this.rateWindowStartMs = nowMs;
      this.rateWindowCount = 0;
    }
  }
}

/** Process-wide queue used by the orchestrated adapter (tests may reset). */
export const defaultVerificationMailQueue = new VerificationMailQueue();
