import type { IdempotencyRecord, MailboxPolicy, Postage, Receipt, SenderRule } from "./domain";
import type { ApiRepository } from "./repository";
import { ApiError } from "./errors";

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

  async setPolicy(owner: string, policy: MailboxPolicy, expectedVersion?: string) {
    const current = this.policies.get(owner);
    if (expectedVersion !== undefined) {
      if (!current || current.version !== expectedVersion) {
        throw new ApiError(409, "conflict", "Concurrency conflict: Policy version mismatch");
      }
    }
    const updated = {
      ...policy,
      version: crypto.randomUUID(),
    };
    this.policies.set(owner, structuredClone(updated));
    return structuredClone(updated);
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

  async setPostage(postage: Postage, expectedVersion?: string) {
    const current = this.postage.get(postage.messageId);
    if (expectedVersion !== undefined) {
      if (!current || current.version !== expectedVersion) {
        throw new ApiError(409, "conflict", "Concurrency conflict: Postage version mismatch");
      }
    }
    const updated = {
      ...postage,
      version: crypto.randomUUID(),
    };
    this.postage.set(postage.messageId, structuredClone(updated));
    return structuredClone(updated);
  }

  async getReceipt(messageId: string) {
    return structuredClone(this.receipts.get(messageId) ?? null);
  }

  async setReceipt(receipt: Receipt, expectedVersion?: string) {
    const current = this.receipts.get(receipt.messageId);
    if (expectedVersion !== undefined) {
      if (!current || current.version !== expectedVersion) {
        throw new ApiError(409, "conflict", "Concurrency conflict: Receipt version mismatch");
      }
    }
    const updated = {
      ...receipt,
      version: crypto.randomUUID(),
    };
    this.receipts.set(receipt.messageId, structuredClone(updated));
    return structuredClone(updated);
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
