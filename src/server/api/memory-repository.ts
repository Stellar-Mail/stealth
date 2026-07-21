import type { IdempotencyRecord, MailboxPolicy, Postage, Receipt, SenderRule } from "./domain";
import type { ApiRepository } from "./repository";

function key(owner: string, sender: string) {
  return `${owner}:${sender}`;
}

export class MemoryApiRepository implements ApiRepository {
  private readonly policies = new Map<string, MailboxPolicy>();
  private readonly postage = new Map<string, Postage>();
  private readonly receipts = new Map<string, Receipt>();
  private readonly senderRules = new Map<string, SenderRule>();
  private readonly counters = new Map<string, number[]>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();

  async getPolicy(owner: string) {
    return structuredClone(this.policies.get(owner) ?? null);
  }

  async setPolicy(owner: string, policy: MailboxPolicy) {
    this.policies.set(owner, structuredClone(policy));
    return structuredClone(policy);
  }

  async getSenderRule(owner: string, sender: string) {
    return this.senderRules.get(key(owner, sender)) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule) {
    const ruleKey = key(owner, sender);
    if (rule === "default") this.senderRules.delete(ruleKey);
    else this.senderRules.set(ruleKey, rule);
    return rule;
  }

  async getPostage(messageId: string) {
    return structuredClone(this.postage.get(messageId) ?? null);
  }

  async setPostage(postage: Postage) {
    this.postage.set(postage.messageId, structuredClone(postage));
    return structuredClone(postage);
  }

  async getReceipt(messageId: string) {
    return structuredClone(this.receipts.get(messageId) ?? null);
  }

  async setReceipt(receipt: Receipt) {
    this.receipts.set(receipt.messageId, structuredClone(receipt));
    return structuredClone(receipt);
  }

  async getRelayQueueDepth(_relayId: string) {
    return 0;
  }

  async getRelayRetryCount(_relayId: string) {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(_relayId: string) {
    return null;
  }

  async getRelayLastFailedDelivery(_relayId: string) {
    return null;
  }

  async getRelayDeadLetterCount(_relayId: string) {
    return 0;
  }
  async getCounter(key: string) {
    return this.counters.get(key)?.length ?? 0;
  }

  async incrementCounter(key: string, windowSeconds: number) {
    const now = Date.now();
    const windowMilliseconds = windowSeconds * 1000;
    const timestamps = this.counters.get(key) ?? [];
    const filtered = [...timestamps, now].filter(
      (timestamp) => now - timestamp <= windowMilliseconds,
    );
    this.counters.set(key, filtered);
    return filtered.length;
  }

  async acquireIdempotencyRecord(
    key: string,
    leaseMs: number,
  ): Promise<import("./repository").AcquireIdempotencyResult> {
    const existing = this.idempotency.get(key);
    const now = Date.now();

    if (existing) {
      if (existing.state === "completed") {
        return { status: "completed", record: structuredClone(existing) };
      }

      // existing is in_progress. Check if lease expired
      if (now < new Date(existing.recoveryExpiryAt).getTime()) {
        return { status: "in_progress" };
      }
    }

    // Acquire the lock
    this.idempotency.set(key, {
      state: "in_progress",
      createdAt: new Date(now).toISOString(),
      recoveryExpiryAt: new Date(now + leaseMs).toISOString(),
    });

    return { status: "acquired" };
  }

  async getIdempotencyRecord(key: string) {
    return structuredClone(this.idempotency.get(key) ?? null);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord) {
    this.idempotency.set(key, structuredClone(record));
  }

  reset() {
    this.policies.clear();
    this.postage.clear();
    this.receipts.clear();
    this.senderRules.clear();
    this.counters.clear();
    this.idempotency.clear();
  }
}
