/**
 * Pure, non-mutating helpers for querying and filtering the inbox seed dataset.
 *
 * All functions accept plain data arrays — they never touch localStorage,
 * the network, or any other side-effect source.
 */

import type { DemoMessage, DemoSender } from "../types/dataset";
import { inboxSeedFolderMap } from "../fixtures/inboxSeedMetadata";

// ---------------------------------------------------------------------------
// Message queries
// ---------------------------------------------------------------------------

/** Returns messages whose labels include `label` (case-insensitive). */
export function getMessagesByLabel(messages: readonly DemoMessage[], label: string): DemoMessage[] {
  const needle = label.toLowerCase();
  return messages.filter((m) => m.labels.some((l) => l.toLowerCase() === needle));
}

/** Returns messages from a specific sender address (exact, case-insensitive). */
export function getMessagesBySender(
  messages: readonly DemoMessage[],
  address: string,
): DemoMessage[] {
  const needle = address.toLowerCase();
  return messages.filter((m) => m.sender.address.toLowerCase() === needle);
}

/** Returns messages that carry a proof record with the given status. */
export function getMessagesByProofStatus(
  messages: readonly DemoMessage[],
  status: "verified" | "pending" | "failed" | "none",
): DemoMessage[] {
  return messages.filter((m) => (m.proofRecord?.status ?? "none") === status);
}

/** Returns messages whose id maps to the given original inbox folder. */
export function getMessagesByFolder(
  messages: readonly DemoMessage[],
  folder: string,
): DemoMessage[] {
  return messages.filter((m) => inboxSeedFolderMap[m.id] === folder);
}

/** Returns only unread messages. */
export function getUnreadMessages(messages: readonly DemoMessage[]): DemoMessage[] {
  return messages.filter((m) => !m.isRead);
}

/** Returns only starred messages. */
export function getStarredMessages(messages: readonly DemoMessage[]): DemoMessage[] {
  return messages.filter((m) => m.isStarred);
}

/** Returns messages that carry at least one attachment. */
export function getMessagesWithAttachments(messages: readonly DemoMessage[]): DemoMessage[] {
  return messages.filter((m) => m.attachments.length > 0);
}

/** Returns messages that carry a calendar event. */
export function getMessagesWithCalendarEvent(messages: readonly DemoMessage[]): DemoMessage[] {
  return messages.filter((m) => m.calendarEvent != null);
}

/** Returns messages that are snoozed (have a snoozeRemindAt). */
export function getSnoozedMessages(messages: readonly DemoMessage[]): DemoMessage[] {
  return messages.filter((m) => m.snoozeRemindAt != null);
}

// ---------------------------------------------------------------------------
// Sender queries
// ---------------------------------------------------------------------------

/** Returns trusted senders from a list. */
export function getTrustedSenders(senders: readonly DemoSender[]): DemoSender[] {
  return senders.filter((s) => s.isTrusted);
}

/** Returns untrusted senders from a list. */
export function getUntrustedSenders(senders: readonly DemoSender[]): DemoSender[] {
  return senders.filter((s) => !s.isTrusted);
}

/** Returns senders that have an associated relay node. */
export function getRelaySenders(senders: readonly DemoSender[]): DemoSender[] {
  return senders.filter((s) => s.relayNode != null);
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

/** Returns a sorted list of every unique label across the messages. */
export function collectLabels(messages: readonly DemoMessage[]): string[] {
  const labels = new Set<string>();
  for (const msg of messages) {
    for (const label of msg.labels) {
      labels.add(label);
    }
  }
  return [...labels].sort();
}

/**
 * Returns a record mapping each original-inbox folder to the number of
 * seed messages assigned to it.
 */
export function computeFolderDistribution(
  messages: readonly DemoMessage[],
): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const msg of messages) {
    const folder = inboxSeedFolderMap[msg.id] ?? "unknown";
    dist[folder] = (dist[folder] ?? 0) + 1;
  }
  return dist;
}

/**
 * Looks up a single message by id.
 * Returns `undefined` when no message matches.
 */
export function findMessageById(
  messages: readonly DemoMessage[],
  id: string,
): DemoMessage | undefined {
  return messages.find((m) => m.id === id);
}

/**
 * Looks up a single sender by address (case-insensitive).
 * Returns `undefined` when no sender matches.
 */
export function findSenderByAddress(
  senders: readonly DemoSender[],
  address: string,
): DemoSender | undefined {
  const needle = address.toLowerCase();
  return senders.find((s) => s.address.toLowerCase() === needle);
}
