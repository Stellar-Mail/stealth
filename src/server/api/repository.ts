import type { IdempotencyRecord, MailboxPolicy, Postage, Receipt, SenderRule } from "./domain";

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
  getReceipt(messageId: string, opts?: AbortOptions): Promise<Receipt | null>;
  setReceipt(receipt: Receipt, opts?: AbortOptions): Promise<Receipt>;
  getIdempotencyRecord(key: string, opts?: AbortOptions): Promise<IdempotencyRecord | null>;
  setIdempotencyRecord(key: string, record: IdempotencyRecord, opts?: AbortOptions): Promise<void>;
  getRelayQueueDepth(relayId: string, opts?: AbortOptions): Promise<number>;
  getRelayRetryCount(relayId: string, opts?: AbortOptions): Promise<number>;
  getRelayLastSuccessfulDelivery(relayId: string, opts?: AbortOptions): Promise<string | null>;
  getRelayLastFailedDelivery(relayId: string, opts?: AbortOptions): Promise<string | null>;
  getRelayDeadLetterCount(relayId: string, opts?: AbortOptions): Promise<number>;
  getCounter(key: string, opts?: AbortOptions): Promise<number>;
  incrementCounter(key: string, windowSeconds: number, opts?: AbortOptions): Promise<number>;
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
