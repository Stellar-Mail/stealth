import { recordDependencyCall } from "./metrics";
import type { ApiRepository } from "./repository";
import type { MailboxPolicy, SenderRule, Postage, Receipt, IdempotencyRecord } from "./domain";

export class HybridApiRepository implements ApiRepository {
  constructor(
    private readonly kv: KVNamespace,
    private readonly coordinator: DurableObjectNamespace,
  ) {}

  private key(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(":")}`;
  }

  async getPolicy(owner: string): Promise<MailboxPolicy | null> {
    const policy = await recordDependencyCall("kv", () =>
      this.kv.get(this.key("policy", owner), "json"),
    );
    return (policy as MailboxPolicy) ?? null;
  }

  async setPolicy(owner: string, policy: MailboxPolicy): Promise<MailboxPolicy> {
    await recordDependencyCall("kv", () =>
      this.kv.put(this.key("policy", owner), JSON.stringify(policy)),
    );
    return policy;
  }

  async getSenderRule(owner: string, sender: string): Promise<SenderRule> {
    const rule = await recordDependencyCall("kv", () =>
      this.kv.get(this.key("sender-rule", owner, sender), "text"),
    );
    return (rule as SenderRule) ?? "default";
  }

  async setSenderRule(owner: string, sender: string, rule: SenderRule): Promise<SenderRule> {
    const ruleKey = this.key("sender-rule", owner, sender);
    if (rule === "default") {
      await recordDependencyCall("kv", () => this.kv.delete(ruleKey));
    } else {
      await recordDependencyCall("kv", () => this.kv.put(ruleKey, rule));
    }
    return rule;
  }

  async getPostage(messageId: string): Promise<Postage | null> {
    const postage = await recordDependencyCall("kv", () =>
      this.kv.get(this.key("postage", messageId), "json"),
    );
    return (postage as Postage) ?? null;
  }

  async setPostage(postage: Postage): Promise<Postage> {
    await recordDependencyCall("kv", () =>
      this.kv.put(this.key("postage", postage.messageId), JSON.stringify(postage)),
    );
    return postage;
  }

  async getReceipt(messageId: string): Promise<Receipt | null> {
    const receipt = await recordDependencyCall("kv", () =>
      this.kv.get(this.key("receipt", messageId), "json"),
    );
    return (receipt as Receipt) ?? null;
  }

  async setReceipt(receipt: Receipt): Promise<Receipt> {
    await recordDependencyCall("kv", () =>
      this.kv.put(this.key("receipt", receipt.messageId), JSON.stringify(receipt)),
    );
    return receipt;
  }

  // Consistent layer delegated to Durable Object via RPC
  private getStub() {
    const id = this.coordinator.idFromName("global-stealth-coordinator");
    return this.coordinator.get(id);
  }

  async getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
    return recordDependencyCall("coordinator", () => this.getStub().getIdempotencyRecord(key));
  }

  async setIdempotencyRecord(key: string, record: IdempotencyRecord): Promise<void> {
    await recordDependencyCall("coordinator", () => this.getStub().setIdempotencyRecord(key, record));
  }

  async getCounter(key: string): Promise<number> {
    return recordDependencyCall("coordinator", () => this.getStub().getCounter(key));
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    return recordDependencyCall("coordinator", () =>
      this.getStub().incrementCounter(key, windowSeconds),
    );
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
