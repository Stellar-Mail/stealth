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
    const p = this.postage.get(messageId);
    return p ? { ...p } : null;
  }

  async setPostage(postage: Postage) {
    const stored = { ...postage };
    this.postage.set(postage.messageId, stored);
    return { ...stored };
  }

  async getReceipt(messageId: string) {
    const r = this.receipts.get(messageId);
    return r ? { ...r } : null;
  }

  async setReceipt(receipt: Receipt) {
    const stored = { ...receipt };
    this.receipts.set(receipt.messageId, stored);
    return { ...stored };
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
    const cutoff = now - windowSeconds * 1000;
    const timestamps = this.counters.get(key) ?? [];
    let i = 0;
    while (i < timestamps.length && timestamps[i] <= cutoff) i++;
    const fresh = timestamps.slice(i);
    fresh.push(now);
    this.counters.set(key, fresh);
    return fresh.length;
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
