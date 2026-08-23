/**
 * Mailbox sync persistence boundary (Issue #1941 BETA-034).
 *
 * The event log is append-only and recipient-scoped. Quarantine records store
 * reason codes only — never the rejected payload. Checkpoints are keyed by
 * owner + device so concurrent tabs on the same device share one cursor.
 */
import type {
  AppendEventInput,
  MailboxCheckpoint,
  MailboxSyncEvent,
  QuarantineRecord,
} from "./mailbox-sync-types";

export interface ListSyncEventsResult {
  events: MailboxSyncEvent[];
  hasMore: boolean;
  headSeq: number;
  minSeq: number;
}

export interface AppendSyncEventResult {
  event: MailboxSyncEvent;
  created: boolean;
}

export interface MailboxSyncPersistence {
  ping(): Promise<void>;

  /**
   * Serialize work for a single message id so concurrent workers cannot both
   * deliver and both append.
   */
  withMessageLock<T>(messageId: string, action: () => Promise<T>): Promise<T>;

  appendEvent(input: AppendEventInput): Promise<AppendSyncEventResult>;

  listEvents(owner: string, afterSeq: number, limit: number): Promise<ListSyncEventsResult>;

  getDeliveredSeq(owner: string, messageId: string): Promise<number | null>;

  getLatestEventType(owner: string, messageId: string): Promise<MailboxSyncEvent["type"] | null>;

  putQuarantine(record: QuarantineRecord): Promise<{ created: boolean; record: QuarantineRecord }>;

  getQuarantine(messageId: string): Promise<QuarantineRecord | null>;

  saveCheckpoint(checkpoint: MailboxCheckpoint): Promise<MailboxCheckpoint>;

  getCheckpoint(owner: string, deviceId: string): Promise<MailboxCheckpoint | null>;
}
