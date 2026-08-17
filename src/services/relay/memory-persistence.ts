/**
 * In-memory relay persistence (Issue #1935 BETA-028).
 *
 * Used by the Docker entry and development builds. Not durable across restarts;
 * the Cloudflare deployment uses {@link KvRelayPersistence} instead.
 */
import type { RelayEnvelope, RelayPersistence } from "./persistence";

export class MemoryRelayPersistence implements RelayPersistence {
  private readonly queue: RelayEnvelope[] = [];
  private readonly messages = new Map<string, RelayEnvelope>();
  private retryCount = 0;
  private deadLetterCount = 0;
  private available = true;

  async ping(): Promise<void> {
    if (!this.available) {
      throw new Error("Relay storage is unavailable");
    }
  }

  async getQueueDepth(): Promise<number> {
    return this.queue.length;
  }

  async getRetryCount(): Promise<number> {
    return this.retryCount;
  }

  async getDeadLetterCount(): Promise<number> {
    return this.deadLetterCount;
  }

  async enqueue(envelope: RelayEnvelope): Promise<{ messageId: string }> {
    if (!this.available) {
      throw new Error("Relay storage is unavailable");
    }
    this.messages.set(envelope.messageId, envelope);
    this.queue.push(envelope);
    return { messageId: envelope.messageId };
  }

  async dequeue(): Promise<RelayEnvelope | null> {
    if (this.queue.length === 0) return null;
    return this.queue.shift()!;
  }

  async recordRetry(): Promise<void> {
    this.retryCount++;
  }

  async recordDeadLetter(): Promise<void> {
    this.deadLetterCount++;
  }

  async listRecipientQueue(recipient: string): Promise<RelayEnvelope[]> {
    const norm = recipient.toUpperCase().trim();
    return this.queue
      .filter((env) => env.recipient.toUpperCase().trim() === norm)
      .map((env) => ({ ...env }));
  }

  /** Test/ops hook: simulate a storage outage. */
  setAvailable(available: boolean): void {
    this.available = available;
  }

  /** Test/ops hook: inspect an accepted message. */
  getMessage(messageId: string): RelayEnvelope | undefined {
    return this.messages.get(messageId);
  }
}
