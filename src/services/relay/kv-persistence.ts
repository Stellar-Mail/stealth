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
  private static readonly QUEUE_IDS_KEY = "relay:queue:ids";

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

  async enqueue(envelope: RelayEnvelope): Promise<{ messageId: string }> {
    const ids = await this.readQueueIds();
    const alreadyQueued = ids.includes(envelope.messageId);
    await this.kv.put(
      `${KvRelayPersistence.MESSAGE_PREFIX}${envelope.messageId}`,
      JSON.stringify(envelope),
    );
    if (!alreadyQueued) {
      ids.push(envelope.messageId);
      await this.kv.put(KvRelayPersistence.QUEUE_IDS_KEY, JSON.stringify(ids));
      await this.kv.put(KvRelayPersistence.QUEUE_DEPTH_KEY, String(ids.length));
    }
    return { messageId: envelope.messageId };
  }

  async dequeue(): Promise<RelayEnvelope | null> {
    const ids = await this.readQueueIds();
    const messageId = ids.shift();
    if (!messageId) return null;
    const envelope = (await this.kv.get(
      `${KvRelayPersistence.MESSAGE_PREFIX}${messageId}`,
      "json",
    )) as RelayEnvelope | null;
    await this.kv.put(KvRelayPersistence.QUEUE_IDS_KEY, JSON.stringify(ids));
    await this.kv.put(KvRelayPersistence.QUEUE_DEPTH_KEY, String(ids.length));
    return envelope;
  }

  private async readQueueIds(): Promise<string[]> {
    const raw = (await this.kv.get(KvRelayPersistence.QUEUE_IDS_KEY, "json")) as string[] | null;
    return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
  }

  async recordRetry(): Promise<void> {
    await this.incrementCounter(KvRelayPersistence.RETRY_KEY);
  }

  async recordDeadLetter(): Promise<void> {
    await this.incrementCounter(KvRelayPersistence.DEAD_LETTER_KEY);
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
