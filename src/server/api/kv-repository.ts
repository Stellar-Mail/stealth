import type { ApiRepository, PostageTransitionResult } from "./repository";
import type {
  MailboxPolicy,
  SenderRule,
  Postage,
  PostageStatus,
  Receipt,
  IdempotencyRecord,
} from "./domain";

export class HybridApiRepository implements ApiRepository {
  constructor(
    private readonly kv: KVNamespace,
    private readonly coordinator: DurableObjectNamespace,
  ) {}

  private key(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const policy = await this.kv.get(this.key("policy", owner), "json");
    return (policy as MailboxPolicy) ?? null;
  }

  async setPolicy(
    owner: string,
    policy: MailboxPolicy,
    expectedVersion?: string,
  ): Promise<MailboxPolicy> {
    const nextVersion = crypto.randomUUID();
    const key = this.key("policy", owner);
    await this.getStub().checkAndSetVersion(key, expectedVersion, nextVersion);
    const updated = { ...policy, version: nextVersion };
    await this.kv.put(key, JSON.stringify(updated));
    return updated;
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

  async setPostage(postage: Postage, expectedVersion?: string): Promise<Postage> {
    const nextVersion = crypto.randomUUID();
    const key = this.key("postage", postage.messageId);
    await this.getStub().checkAndSetVersion(key, expectedVersion, nextVersion);
    const updated = { ...postage, version: nextVersion };
    await this.kv.put(key, JSON.stringify(updated));
    return updated;
  }

  // Settling/refunding postage must be atomic: two concurrent requests
  // racing on the same messageId must not both succeed. KV get-then-put
  // cannot guarantee that, so the compare-and-swap is delegated to the
  // Durable Object coordinator, then mirrored back into KV for fast reads.
  async transitionPostage(
    messageId: string,
    expectedStatus: PostageStatus,
    nextStatus: PostageStatus,
  ): Promise<PostageTransitionResult> {
    const result = await this.getStub().transitionPostage(messageId, expectedStatus, nextStatus);
    if (result.outcome === "applied") {
      await this.kv.put(this.key("postage", messageId), JSON.stringify(result.postage));
    }
    return result;
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const receipt = await this.kv.get(this.key("receipt", messageId), "json");
    return (receipt as Receipt) ?? null;
  }

  async setReceipt(receipt: Receipt, expectedVersion?: string): Promise<Receipt> {
    const nextVersion = crypto.randomUUID();
    const key = this.key("receipt", receipt.messageId);
    await this.getStub().checkAndSetVersion(key, expectedVersion, nextVersion);
    const updated = { ...receipt, version: nextVersion };
    await this.kv.put(key, JSON.stringify(updated));
    return updated;
  }

  // Consistent layer delegated to Durable Object via RPC
  private getStub() {
    const id = this.coordinator.idFromName("global-stealth-coordinator");
    return this.coordinator.get(id);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return this.getStub().getIdempotencyRecord(key);
  }

  async acquireIdempotencyRecord(
    key: string,
    leaseMs: number,
  ): Promise<import("./repository").AcquireIdempotencyResult> {
    return this.getStub().acquireIdempotencyRecord(key, leaseMs);
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await this.getStub().setIdempotencyRecord(key, record);
  }

  async getCounter(key: string): Promise<number> {
    return this.getStub().getCounter(key);
  }

  async incrementCounter(key: string, windowSeconds: number, amount = 1): Promise<number> {
    return this.getStub().incrementCounter(key, windowSeconds, amount);
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
