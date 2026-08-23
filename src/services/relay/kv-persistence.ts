/**
 * Cloudflare KV relay persistence (Issue #1935 BETA-028).
 *
 * Production adapter used inside the Cloudflare worker. Messages are stored
 * under a per-id key and aggregate counters are maintained in separate KV keys
 * so readiness probes never scan user data. Delivery is drained by a scheduled
 * worker, so {@link dequeue} is a best-effort read that is not atomic.
 */
import type { RelayEnvelope, RelayPersistence } from "./persistence";

export class KvRelayPersistence implements RelayPersistence {
  private static readonly PING_KEY = "relay:ping";
  private static readonly QUEUE_DEPTH_KEY = "relay:queue:depth";
  private static readonly RETRY_KEY = "relay:retry";
  private static readonly DEAD_LETTER_KEY = "relay:dead-letter";
  private static readonly MESSAGE_PREFIX = "relay:message:";

  constructor(private readonly kv: KVNamespace) {}

  async ping(): Promise<void> {
    await this.kv.get(KvRelayPersistence.PING_KEY, "text");
  }

  async getQueueDepth(): Promise<number> {
    return this.readCounter(KvRelayPersistence.QUEUE_DEPTH_KEY);
  }

  async getRetryCount(): Promise<number> {
    return this.readCounter(KvRelayPersistence.RETRY_KEY);
  }

  async getDeadLetterCount(): Promise<number> {
    return this.readCounter(KvRelayPersistence.DEAD_LETTER_KEY);
  }

  async get(messageId: string): Promise<RelayEnvelope | null> {
    const existing = await this.kv.get(`${KvRelayPersistence.MESSAGE_PREFIX}${messageId}`, "json");
    return existing ? (existing as RelayEnvelope) : null;
  }

  async enqueue(envelope: RelayEnvelope): Promise<{ messageId: string }> {
    const existing = await this.get(envelope.messageId);
    if (existing) {
      return { messageId: envelope.messageId };
    }
    await this.kv.put(
      `${KvRelayPersistence.MESSAGE_PREFIX}${envelope.messageId}`,
      JSON.stringify(envelope),
    );
    const depth = await this.getQueueDepth();
    await this.kv.put(KvRelayPersistence.QUEUE_DEPTH_KEY, String(depth + 1));
    return { messageId: envelope.messageId };
  }

  async dequeue(): Promise<RelayEnvelope | null> {
    return null;
  }

  async recordRetry(): Promise<void> {
    await this.incrementCounter(KvRelayPersistence.RETRY_KEY);
  }

  async recordDeadLetter(): Promise<void> {
    await this.incrementCounter(KvRelayPersistence.DEAD_LETTER_KEY);
  }

  async listRecipientQueue(recipient: string): Promise<RelayEnvelope[]> {
    const kv = this.kv as any;
    const list = await kv.list({ prefix: KvRelayPersistence.MESSAGE_PREFIX });
    const results: RelayEnvelope[] = [];
    const norm = recipient.toUpperCase().trim();
    for (const key of list.keys) {
      const envelope = (await this.kv.get(key.name, "json")) as RelayEnvelope | null;
      if (envelope && envelope.recipient?.toUpperCase().trim() === norm) {
        results.push(envelope);
      }
    }
    return results;
  }

  private async readCounter(key: string): Promise<number> {
    const raw = await this.kv.get(key, "text");
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private async incrementCounter(key: string): Promise<void> {
    const value = await this.readCounter(key);
    await this.kv.put(key, String(value + 1));
  }
}
