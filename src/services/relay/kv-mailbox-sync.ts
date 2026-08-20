/**
 * Cloudflare KV mailbox sync persistence (Issue #1941 BETA-034).
 *
 * Event records, checkpoints, and quarantine metadata are stored under
 * recipient-scoped keys. Quarantine values never include the rejected payload.
 */
import type {
  AppendEventInput,
  MailboxCheckpoint,
  MailboxSyncEvent,
  QuarantineRecord,
} from "./mailbox-sync-types";
import { FULL_RESYNC_EVENT_BOUND } from "./mailbox-sync-types";
import type {
  AppendSyncEventResult,
  ListSyncEventsResult,
  MailboxSyncPersistence,
} from "./mailbox-sync-persistence";

export class KvMailboxSyncPersistence implements MailboxSyncPersistence {
  private static readonly HEAD_PREFIX = "mailbox:sync:head:";
  private static readonly MIN_PREFIX = "mailbox:sync:min:";
  private static readonly EVENT_PREFIX = "mailbox:sync:event:";
  private static readonly DELIVERED_PREFIX = "mailbox:sync:delivered:";
  private static readonly TYPE_PREFIX = "mailbox:sync:type:";
  private static readonly QUARANTINE_PREFIX = "mailbox:quarantine:";
  private static readonly CHECKPOINT_PREFIX = "mailbox:checkpoint:";
  private static readonly LOCK_PREFIX = "mailbox:ingest-lock:";

  constructor(private readonly kv: KVNamespace) {}

  async ping(): Promise<void> {
    await this.kv.get("mailbox:sync:ping", "text");
  }

  async withMessageLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
    const lockKey = `${KvMailboxSyncPersistence.LOCK_PREFIX}${messageId}`;
    const existing = await this.kv.get(lockKey, "text");
    if (existing) {
      // Another worker holds the lease; still run the action so idempotent
      // append/quarantine checks observe the winner's write.
      return action();
    }
    await this.kv.put(lockKey, "1", { expirationTtl: 30 });
    try {
      return await action();
    } finally {
      await this.kv.delete(lockKey);
    }
  }

  async appendEvent(input: AppendEventInput): Promise<AppendSyncEventResult> {
    if (input.type === "upsert") {
      const delivered = await this.getDeliveredSeq(input.recipient, input.messageId);
      if (delivered !== null) {
        const existing = await this.getEvent(input.recipient, delivered);
        if (existing) {
          return { event: existing, created: false };
        }
      }
    }
    if (input.type === "tombstone") {
      const latest = await this.getLatestEventType(input.recipient, input.messageId);
      if (latest === "tombstone") {
        const head = await this.readCounter(
          `${KvMailboxSyncPersistence.HEAD_PREFIX}${input.recipient}`,
        );
        for (let seq = head; seq >= 1; seq -= 1) {
          const existing = await this.getEvent(input.recipient, seq);
          if (existing?.messageId === input.messageId && existing.type === "tombstone") {
            return { event: existing, created: false };
          }
        }
      }
    }

    const headKey = `${KvMailboxSyncPersistence.HEAD_PREFIX}${input.recipient}`;
    const minKey = `${KvMailboxSyncPersistence.MIN_PREFIX}${input.recipient}`;
    const nextSeq = (await this.readCounter(headKey)) + 1;
    const event: MailboxSyncEvent = { ...input, seq: nextSeq };
    await this.kv.put(this.eventKey(input.recipient, nextSeq), JSON.stringify(event));
    await this.kv.put(headKey, String(nextSeq));
    const minSeq = await this.readCounter(minKey);
    if (minSeq === 0) {
      await this.kv.put(minKey, "1");
    }
    await this.kv.put(
      `${KvMailboxSyncPersistence.TYPE_PREFIX}${input.recipient}:${input.messageId}`,
      input.type,
    );
    if (input.type === "upsert") {
      await this.kv.put(
        `${KvMailboxSyncPersistence.DELIVERED_PREFIX}${input.recipient}:${input.messageId}`,
        String(nextSeq),
      );
    }
    await this.compactIfNeeded(input.recipient, nextSeq);
    return { event, created: true };
  }

  async listEvents(owner: string, afterSeq: number, limit: number): Promise<ListSyncEventsResult> {
    const headSeq = await this.readCounter(`${KvMailboxSyncPersistence.HEAD_PREFIX}${owner}`);
    const storedMin = await this.readCounter(`${KvMailboxSyncPersistence.MIN_PREFIX}${owner}`);
    const minSeq = headSeq === 0 ? 0 : storedMin || 1;
    const events: MailboxSyncEvent[] = [];
    let cursor = afterSeq + 1;
    while (cursor <= headSeq && events.length < limit + 1) {
      const event = await this.getEvent(owner, cursor);
      if (event) events.push(event);
      cursor += 1;
    }
    const hasMore = events.length > limit;
    return {
      events: events.slice(0, limit),
      hasMore,
      headSeq,
      minSeq,
    };
  }

  async getDeliveredSeq(owner: string, messageId: string): Promise<number | null> {
    const raw = await this.kv.get(
      `${KvMailboxSyncPersistence.DELIVERED_PREFIX}${owner}:${messageId}`,
      "text",
    );
    if (raw === null) return null;
    const seq = Number(raw);
    return Number.isSafeInteger(seq) && seq > 0 ? seq : null;
  }

  async getLatestEventType(
    owner: string,
    messageId: string,
  ): Promise<MailboxSyncEvent["type"] | null> {
    const raw = await this.kv.get(
      `${KvMailboxSyncPersistence.TYPE_PREFIX}${owner}:${messageId}`,
      "text",
    );
    if (raw === "upsert" || raw === "state" || raw === "tombstone") return raw;
    return null;
  }

  async putQuarantine(
    record: QuarantineRecord,
  ): Promise<{ created: boolean; record: QuarantineRecord }> {
    const key = `${KvMailboxSyncPersistence.QUARANTINE_PREFIX}${record.messageId}`;
    const existing = (await this.kv.get(key, "json")) as QuarantineRecord | null;
    if (existing) {
      return { created: false, record: existing };
    }
    await this.kv.put(key, JSON.stringify(record));
    return { created: true, record };
  }

  async getQuarantine(messageId: string): Promise<QuarantineRecord | null> {
    return (
      ((await this.kv.get(
        `${KvMailboxSyncPersistence.QUARANTINE_PREFIX}${messageId}`,
        "json",
      )) as QuarantineRecord | null) ?? null
    );
  }

  async saveCheckpoint(checkpoint: MailboxCheckpoint): Promise<MailboxCheckpoint> {
    const key = `${KvMailboxSyncPersistence.CHECKPOINT_PREFIX}${checkpoint.owner}:${checkpoint.deviceId}`;
    const existing = (await this.kv.get(key, "json")) as MailboxCheckpoint | null;
    if (existing && existing.seq > checkpoint.seq) {
      return existing;
    }
    await this.kv.put(key, JSON.stringify(checkpoint));
    return checkpoint;
  }

  async getCheckpoint(owner: string, deviceId: string): Promise<MailboxCheckpoint | null> {
    return (
      ((await this.kv.get(
        `${KvMailboxSyncPersistence.CHECKPOINT_PREFIX}${owner}:${deviceId}`,
        "json",
      )) as MailboxCheckpoint | null) ?? null
    );
  }

  private eventKey(owner: string, seq: number): string {
    return `${KvMailboxSyncPersistence.EVENT_PREFIX}${owner}:${seq}`;
  }

  private async getEvent(owner: string, seq: number): Promise<MailboxSyncEvent | null> {
    return (
      ((await this.kv.get(this.eventKey(owner, seq), "json")) as MailboxSyncEvent | null) ?? null
    );
  }

  private async compactIfNeeded(owner: string, headSeq: number): Promise<void> {
    const minKey = `${KvMailboxSyncPersistence.MIN_PREFIX}${owner}`;
    const minSeq = (await this.readCounter(minKey)) || 1;
    const retained = headSeq - minSeq + 1;
    if (retained <= FULL_RESYNC_EVENT_BOUND) return;
    const dropUntil = headSeq - FULL_RESYNC_EVENT_BOUND + 1;
    for (let seq = minSeq; seq < dropUntil; seq += 1) {
      await this.kv.delete(this.eventKey(owner, seq));
    }
    await this.kv.put(minKey, String(dropUntil));
  }

  private async readCounter(key: string): Promise<number> {
    const raw = await this.kv.get(key, "text");
    const value = raw === null ? 0 : Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }
}
