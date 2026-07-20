import type { ApiRepository } from "./repository";
import type { MailboxPolicy, SenderRule, Postage, Receipt, IdempotencyRecord } from "./domain";

/**
 * Issue #1544: on-disk shape for a policy record once versioning was
 * introduced. Pre-existing records written before this change are stored as
 * a bare `MailboxPolicy` with no `__version` field — reads treat those as
 * version 1 for backward compatibility.
 */
type StoredMailboxPolicy = MailboxPolicy & { __version?: number };

export class HybridApiRepository implements ApiRepository {
  constructor(
    private readonly kv: KVNamespace,
    private readonly coordinator: DurableObjectNamespace,
  ) {}

  private key(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const stored = await this.kv.get<StoredMailboxPolicy>(this.key("policy", owner), "json");
    if (!stored) return null;
    const { __version: _version, ...policy } = stored;
    return policy as MailboxPolicy;
  }

  async setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    const currentVersion = await this.getPolicyVersion(owner);
    const stored: StoredMailboxPolicy = { ...policy, __version: currentVersion + 1 };
    await this.kv.put(this.key("policy", owner), JSON.stringify(stored));
    return policy;
  }

  async getPolicyVersion(owner: string): Promise<number> {
    const stored = await this.kv.get<StoredMailboxPolicy>(this.key("policy", owner), "json");
    if (!stored) return 0;
    // Pre-versioning records have no __version field; treat them as v1.
    return stored.__version ?? 1;
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const rule = await this.kv.get(this.key("sender-rule", owner, sender), "text");
    return (rule as SenderRule) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    const ruleKey = this.key("sender-rule", owner, sender);
    if (rule === "default") {
      await this.kv.delete(ruleKey);
    } else {
      await this.kv.put(ruleKey, rule);
    }
    return rule;
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const postage = await this.kv.get(this.key("postage", messageId), "json");
    return (postage as Postage) ?? null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    await this.kv.put(this.key("postage", postage.messageId), JSON.stringify(postage));
    return postage;
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const receipt = await this.kv.get(this.key("receipt", messageId), "json");
    return (receipt as Receipt) ?? null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    await this.kv.put(this.key("receipt", receipt.messageId), JSON.stringify(receipt));
    return receipt;
  }

  // Consistent layer delegated to Durable Object via RPC
  private getStub() {
    const id = this.coordinator.idFromName("global-stealth-coordinator");
    return this.coordinator.get(id);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return this.getStub().getIdempotencyRecord(key);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await this.getStub().setIdempotencyRecord(key, record);
  }

  async getCounter(key: string): Promise<number> {
    return this.getStub().getCounter(key);
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    return this.getStub().incrementCounter(key, windowSeconds);
  }

  // Relay stats stubs matching MemoryApiRepository exactly
  async getRelayQueueDepth(_relayId: string): Promise<number> {
    return 0;
  }

  async getRelayRetryCount(_relayId: string): Promise<number> {
    return 0;
  }

  async getRelayLastSuccessfulDelivery(_relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayLastFailedDelivery(_relayId: string): Promise<string | null> {
    return null;
  }

  async getRelayDeadLetterCount(_relayId: string): Promise<number> {
    return 0;
  }
}
