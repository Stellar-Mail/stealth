/**
 * Mailbox incremental-sync domain service (Issue #1941 BETA-034).
 *
 * Defines initial sync, delta sync, tombstone, and cursor-expiry behaviour.
 * Sync responses never include quarantined payloads. Checkpoints are persisted
 * per owner + device so a reconnect resumes from the last acknowledged seq.
 */
import { ApiError } from "@/server/api/errors";

import { decodeMailboxCursor, encodeMailboxCursor } from "./mailbox-cursor";
import type { MailboxSyncPersistence } from "./mailbox-sync-persistence";
import {
  DEFAULT_SYNC_PAGE_SIZE,
  MAX_SYNC_PAGE_SIZE,
  mailboxSyncRequestSchema,
  type AppendEventInput,
  type MailboxCheckpoint,
  type MailboxSyncEvent,
  type MailboxSyncRequest,
  type MailboxSyncResult,
  type QuarantineRecord,
} from "./mailbox-sync-types";

export interface MailboxSyncServiceOptions {
  now?: () => number;
}

function redactEvent(event: MailboxSyncEvent): MailboxSyncEvent {
  return {
    seq: event.seq,
    type: event.type,
    messageId: event.messageId,
    occurredAt: event.occurredAt,
    recipient: event.recipient,
    ...(event.sender ? { sender: event.sender } : {}),
    ...(event.ciphertext ? { ciphertext: event.ciphertext } : {}),
    ...(event.objectKey ? { objectKey: event.objectKey } : {}),
    ...(event.state ? { state: event.state } : {}),
    ...(event.reason ? { reason: event.reason } : {}),
  };
}

export class MailboxSyncService {
  constructor(
    private readonly persistence: MailboxSyncPersistence,
    private readonly options: MailboxSyncServiceOptions = {},
  ) {}

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  /**
   * Incremental mailbox walk. A missing cursor is an initial sync; a valid
   * cursor is a delta from the acknowledged seq. Expired or compacted cursors
   * throw `cursor_expired` so the client starts a bounded full resync.
   */
  async sync(owner: string, input: MailboxSyncRequest): Promise<MailboxSyncResult> {
    const parsed = mailboxSyncRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw parsed.error;
    }

    const limit = parsed.data.limit ?? DEFAULT_SYNC_PAGE_SIZE;
    if (limit > MAX_SYNC_PAGE_SIZE) {
      throw new ApiError(422, "validation_error", "Sync page size exceeds the maximum");
    }

    const nowMs = this.now();
    let afterSeq = 0;
    let mode: MailboxSyncResult["mode"] = "initial";

    if (parsed.data.cursor) {
      const decoded = decodeMailboxCursor(parsed.data.cursor, owner, parsed.data.deviceId, nowMs);
      const listing = await this.persistence.listEvents(owner, decoded.seq, 1);
      if (listing.minSeq > 0 && decoded.seq + 1 < listing.minSeq) {
        throw new ApiError(
          410,
          "cursor_expired",
          "Mailbox sync cursor is older than the retained event window",
        );
      }
      afterSeq = decoded.seq;
      mode = "delta";
    }

    const page = await this.persistence.listEvents(owner, afterSeq, limit);
    const acknowledgedSeq = page.events.at(-1)?.seq ?? afterSeq;
    const cursor = encodeMailboxCursor(owner, parsed.data.deviceId, acknowledgedSeq, nowMs);

    await this.persistence.saveCheckpoint({
      owner,
      deviceId: parsed.data.deviceId,
      seq: acknowledgedSeq,
      updatedAt: new Date(nowMs).toISOString(),
    });

    return {
      mode,
      events: page.events.map(redactEvent),
      cursor,
      hasMore: page.hasMore,
    };
  }

  async append(input: AppendEventInput): Promise<{ event: MailboxSyncEvent; created: boolean }> {
    return this.persistence.appendEvent(input);
  }

  async recordTombstone(
    owner: string,
    messageId: string,
    reason: NonNullable<MailboxSyncEvent["reason"]> = "deleted",
  ): Promise<{ event: MailboxSyncEvent; created: boolean }> {
    return this.persistence.appendEvent({
      type: "tombstone",
      messageId,
      recipient: owner,
      occurredAt: new Date(this.now()).toISOString(),
      reason,
    });
  }

  async recordStateChange(
    owner: string,
    messageId: string,
    state: NonNullable<MailboxSyncEvent["state"]>,
  ): Promise<{ event: MailboxSyncEvent; created: boolean }> {
    return this.persistence.appendEvent({
      type: "state",
      messageId,
      recipient: owner,
      occurredAt: new Date(this.now()).toISOString(),
      state,
    });
  }

  async getCheckpoint(owner: string, deviceId: string): Promise<MailboxCheckpoint | null> {
    return this.persistence.getCheckpoint(owner, deviceId);
  }

  async getQuarantine(messageId: string): Promise<QuarantineRecord | null> {
    return this.persistence.getQuarantine(messageId);
  }
}
