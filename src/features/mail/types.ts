/**
 * Client mailbox sync types (Issue #1941 BETA-034).
 */
export type MailboxSyncMode = "initial" | "delta";

export type MailboxSyncEventType = "upsert" | "state" | "tombstone";

export interface MailboxMessageState {
  unread?: boolean;
  starred?: boolean;
  folder?: string;
}

export interface MailboxSyncEvent {
  seq: number;
  type: MailboxSyncEventType;
  messageId: string;
  occurredAt: string;
  recipient: string;
  sender?: string;
  ciphertext?: string;
  objectKey?: string;
  state?: MailboxMessageState;
  reason?: "deleted" | "expired" | "user";
}

export interface MailboxSyncResult {
  mode: MailboxSyncMode;
  events: MailboxSyncEvent[];
  cursor: string;
  hasMore: boolean;
}

export interface MailboxSyncCheckpoint {
  actor: string;
  deviceId: string;
  cursor: string | null;
  appliedSeq: number;
  appliedMessageIds: string[];
  updatedAt: string;
}

export interface SyncedMailboxMessage {
  messageId: string;
  sender?: string;
  recipient: string;
  occurredAt: string;
  ciphertext?: string;
  objectKey?: string;
  unread: boolean;
  starred: boolean;
  folder: string;
}

export class MailboxSyncError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(status: number, code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "MailboxSyncError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}
