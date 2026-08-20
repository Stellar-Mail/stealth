/**
 * Apply mailbox sync events onto a local message map (Issue #1941 BETA-034).
 *
 * Events are applied in seq order. Duplicate seqs and already-seen upserts are
 * ignored so reconnects and overlapping pages cannot double-insert.
 */
import type { MailboxSyncEvent, SyncedMailboxMessage } from "./types";

export interface ApplyResult {
  messages: Map<string, SyncedMailboxMessage>;
  appliedSeq: number;
  skipped: number;
}

export function applySyncEvents(
  current: Map<string, SyncedMailboxMessage>,
  events: readonly MailboxSyncEvent[],
  appliedSeq: number,
): ApplyResult {
  const messages = new Map(current);
  let nextSeq = appliedSeq;
  let skipped = 0;
  const ordered = [...events].sort((a, b) => a.seq - b.seq);

  for (const event of ordered) {
    if (event.seq <= nextSeq) {
      skipped += 1;
      continue;
    }
    if (event.seq !== nextSeq + 1 && nextSeq !== 0 && event.seq > nextSeq + 1) {
      // Gap: still apply in order so an offline hole is filled once the missing
      // seqs arrive, but do not skip ahead past unapplied seqs from this page.
      skipped += 1;
      continue;
    }

    if (event.type === "upsert") {
      const existing = messages.get(event.messageId);
      messages.set(event.messageId, {
        messageId: event.messageId,
        sender: event.sender ?? existing?.sender,
        recipient: event.recipient,
        occurredAt: event.occurredAt,
        ciphertext: event.ciphertext ?? existing?.ciphertext,
        objectKey: event.objectKey ?? existing?.objectKey,
        unread: existing?.unread ?? true,
        starred: existing?.starred ?? false,
        folder: existing?.folder ?? "inbox",
      });
    } else if (event.type === "state") {
      const existing = messages.get(event.messageId);
      if (existing && event.state) {
        messages.set(event.messageId, {
          ...existing,
          unread: event.state.unread ?? existing.unread,
          starred: event.state.starred ?? existing.starred,
          folder: event.state.folder ?? existing.folder,
        });
      }
    } else if (event.type === "tombstone") {
      messages.delete(event.messageId);
    }

    nextSeq = event.seq;
  }

  return { messages, appliedSeq: nextSeq, skipped };
}

export function bufferOutOfOrder(
  pending: MailboxSyncEvent[],
  incoming: readonly MailboxSyncEvent[],
): MailboxSyncEvent[] {
  const bySeq = new Map<number, MailboxSyncEvent>();
  for (const event of pending) bySeq.set(event.seq, event);
  for (const event of incoming) bySeq.set(event.seq, event);
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
