/**
 * In-memory mailbox sync persistence (Issue #1941 BETA-034).
 *
 * Used by tests and the development/Docker path. Production uses the KV
 * adapter. Per-message and per-recipient locks serialize concurrent workers.
 */
import { FULL_RESYNC_EVENT_BOUND } from "./mailbox-sync-types";
import type {
  AppendEventInput,
  MailboxCheckpoint,
  MailboxSyncEvent,
  QuarantineRecord,
} from "./mailbox-sync-types";
import type {
  AppendSyncEventResult,
  ListSyncEventsResult,
  MailboxSyncPersistence,
} from "./mailbox-sync-persistence";

interface RecipientLog {
  events: MailboxSyncEvent[];
  delivered: Map<string, number>;
  latestType: Map<string, MailboxSyncEvent["type"]>;
}

export class MemoryMailboxSyncPersistence implements MailboxSyncPersistence {
  private readonly logs = new Map<string, RecipientLog>();
  private readonly quarantines = new Map<string, QuarantineRecord>();
  private readonly checkpoints = new Map<string, MailboxCheckpoint>();
  private readonly messageLocks = new Map<string, Promise<void>>();
  private readonly recipientLocks = new Map<string, Promise<void>>();
  private available = true;

  async ping(): Promise<void> {
    if (!this.available) {
      throw new Error("Mailbox sync storage is unavailable");
    }
  }

  async withMessageLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
    return this.withLock(this.messageLocks, messageId, action);
  }

  async appendEvent(input: AppendEventInput): Promise<AppendSyncEventResult> {
    await this.ping();
    return this.withLock(this.recipientLocks, input.recipient, async () => {
      const log = this.getOrCreateLog(input.recipient);
      const existingType = log.latestType.get(input.messageId);
      if (input.type === "upsert" && log.delivered.has(input.messageId)) {
        const seq = log.delivered.get(input.messageId)!;
        const existing = log.events.find((event) => event.seq === seq && event.type === "upsert");
        if (existing) {
          return { event: structuredClone(existing), created: false };
        }
      }
      if (input.type === "tombstone" && existingType === "tombstone") {
        const existing = [...log.events]
          .reverse()
          .find((event) => event.messageId === input.messageId && event.type === "tombstone");
        if (existing) {
          return { event: structuredClone(existing), created: false };
        }
      }

      const event: MailboxSyncEvent = { ...input, seq: (log.events.at(-1)?.seq ?? 0) + 1 };
      log.events.push(event);
      log.latestType.set(input.messageId, input.type);
      if (input.type === "upsert") {
        log.delivered.set(input.messageId, event.seq);
      }
      this.compact(log);
      return { event: structuredClone(event), created: true };
    });
  }

  async listEvents(owner: string, afterSeq: number, limit: number): Promise<ListSyncEventsResult> {
    await this.ping();
    const log = this.logs.get(owner);
    const events = log?.events ?? [];
    const remaining = events.filter((event) => event.seq > afterSeq);
    const page = remaining.slice(0, limit).map((event) => structuredClone(event));
    return {
      events: page,
      hasMore: remaining.length > page.length,
      headSeq: events.at(-1)?.seq ?? 0,
      minSeq: events[0]?.seq ?? 0,
    };
  }

  async getDeliveredSeq(owner: string, messageId: string): Promise<number | null> {
    return this.logs.get(owner)?.delivered.get(messageId) ?? null;
  }

  async getLatestEventType(
    owner: string,
    messageId: string,
  ): Promise<MailboxSyncEvent["type"] | null> {
    return this.logs.get(owner)?.latestType.get(messageId) ?? null;
  }

  async putQuarantine(
    record: QuarantineRecord,
  ): Promise<{ created: boolean; record: QuarantineRecord }> {
    await this.ping();
    const existing = this.quarantines.get(record.messageId);
    if (existing) {
      return { created: false, record: structuredClone(existing) };
    }
    this.quarantines.set(record.messageId, structuredClone(record));
    return { created: true, record: structuredClone(record) };
  }

  async getQuarantine(messageId: string): Promise<QuarantineRecord | null> {
    const record = this.quarantines.get(messageId);
    return record ? structuredClone(record) : null;
  }

  async saveCheckpoint(checkpoint: MailboxCheckpoint): Promise<MailboxCheckpoint> {
    await this.ping();
    const key = this.checkpointKey(checkpoint.owner, checkpoint.deviceId);
    const existing = this.checkpoints.get(key);
    if (existing && existing.seq > checkpoint.seq) {
      return structuredClone(existing);
    }
    const stored = structuredClone(checkpoint);
    this.checkpoints.set(key, stored);
    return structuredClone(stored);
  }

  async getCheckpoint(owner: string, deviceId: string): Promise<MailboxCheckpoint | null> {
    const stored = this.checkpoints.get(this.checkpointKey(owner, deviceId));
    return stored ? structuredClone(stored) : null;
  }

  /** Test/ops hook: simulate a storage outage. */
  setAvailable(available: boolean): void {
    this.available = available;
  }

  reset(): void {
    this.logs.clear();
    this.quarantines.clear();
    this.checkpoints.clear();
    this.messageLocks.clear();
    this.recipientLocks.clear();
    this.available = true;
  }

  private getOrCreateLog(owner: string): RecipientLog {
    const existing = this.logs.get(owner);
    if (existing) return existing;
    const created: RecipientLog = {
      events: [],
      delivered: new Map(),
      latestType: new Map(),
    };
    this.logs.set(owner, created);
    return created;
  }

  private compact(log: RecipientLog): void {
    if (log.events.length <= FULL_RESYNC_EVENT_BOUND) return;
    const drop = log.events.length - FULL_RESYNC_EVENT_BOUND;
    log.events.splice(0, drop);
  }

  private checkpointKey(owner: string, deviceId: string): string {
    return `${owner}:${deviceId}`;
  }

  private async withLock<T>(
    locks: Map<string, Promise<void>>,
    key: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const previous = locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    locks.set(key, queued);
    await previous;
    try {
      return await action();
    } finally {
      release();
      if (locks.get(key) === queued) {
        locks.delete(key);
      }
    }
  }
}
