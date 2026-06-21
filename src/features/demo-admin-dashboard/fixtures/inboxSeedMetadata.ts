/**
 * Metadata describing the inbox seed dataset.
 *
 * Provides precomputed, deterministic aggregates that the admin dashboard UI
 * can display without iterating over the messages at render time.
 */

import { inboxSeedDataset, inboxSeedMessages } from "./inboxSeedDataset";

// ---------------------------------------------------------------------------
// Dataset identity
// ---------------------------------------------------------------------------

export interface InboxSeedMetadata {
  /** Dataset id and version matching the source fixture. */
  datasetId: string;
  datasetName: string;
  version: string;

  /** Total message count. */
  totalMessages: number;

  /** Unique sender count. */
  uniqueSenders: number;

  /** Count of messages per label (sorted alphabetically by label). */
  labelCounts: Record<string, number>;

  /** Count of messages that carry a proof record. */
  messagesWithProof: number;

  /** Count of messages that carry a calendar event. */
  messagesWithCalendarEvent: number;

  /** Count of messages that carry at least one attachment. */
  messagesWithAttachments: number;

  /** Count of messages that have a snooze reminder. */
  snoozedMessages: number;

  /** Read / unread split. */
  readCount: number;
  unreadCount: number;

  /** Starred / unstarred split. */
  starredCount: number;
  unstarredCount: number;

  /** Sorted list of all labels present in the dataset. */
  allLabels: string[];

  /** Sorted list of all unique sender display names. */
  allSenderNames: string[];
}

// ---------------------------------------------------------------------------
// Compute (deterministic — runs once at import time)
// ---------------------------------------------------------------------------

function computeLabelCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const msg of inboxSeedMessages) {
    for (const label of msg.labels) {
      counts[label] = (counts[label] ?? 0) + 1;
    }
  }
  return counts;
}

function sortedUnique<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort();
}

export const inboxSeedMetadata: InboxSeedMetadata = {
  datasetId: inboxSeedDataset.id,
  datasetName: inboxSeedDataset.name,
  version: "1.0.0",

  totalMessages: inboxSeedMessages.length,
  uniqueSenders: inboxSeedDataset.senders?.length ?? 0,

  labelCounts: computeLabelCounts(),

  messagesWithProof: inboxSeedMessages.filter((m) => m.proofRecord != null).length,
  messagesWithCalendarEvent: inboxSeedMessages.filter((m) => m.calendarEvent != null).length,
  messagesWithAttachments: inboxSeedMessages.filter((m) => m.attachments.length > 0).length,
  snoozedMessages: inboxSeedMessages.filter((m) => m.snoozeRemindAt != null).length,

  readCount: inboxSeedMessages.filter((m) => m.isRead).length,
  unreadCount: inboxSeedMessages.filter((m) => !m.isRead).length,

  starredCount: inboxSeedMessages.filter((m) => m.isStarred).length,
  unstarredCount: inboxSeedMessages.filter((m) => !m.isStarred).length,

  allLabels: sortedUnique(inboxSeedMessages.flatMap((m) => m.labels)),
  allSenderNames: sortedUnique(inboxSeedMessages.map((m) => m.sender.name ?? m.sender.address)),
};

// ---------------------------------------------------------------------------
// Folder-mirror map
// ---------------------------------------------------------------------------

/**
 * Maps each seed message id to the folder it occupies in the original demo
 * inbox (src/components/mail/data.ts).  This is useful when the admin
 * dashboard needs to show where a seed message will land after publishing.
 *
 * Kept as a separate, explicit lookup rather than derived from the messages
 * so that a future refactor of DemoMessage does not silently drop the mapping.
 */
export const inboxSeedFolderMap: Record<string, string> = {
  "seed-msg-01": "priority",
  "seed-msg-02": "verified",
  "seed-msg-03": "pending",
  "seed-msg-04": "inbox",
  "seed-msg-05": "requests",
  "seed-msg-05b": "requests",
  "seed-msg-05c": "requests",
  "seed-msg-06": "encrypted",
  "seed-msg-06b": "encrypted",
  "seed-msg-06c": "encrypted",
  "seed-msg-06d": "encrypted",
  "seed-msg-07": "receipts",
  "seed-msg-08": "snoozed",
  "seed-msg-09": "archive",
  "seed-msg-10": "sent",
  "seed-msg-11": "drafts",
  "seed-msg-12": "scheduled",
  "seed-msg-13": "outbox",
  "seed-msg-14": "spam",
  "seed-msg-15": "trash",
  "seed-msg-16": "inbox",
};

/**
 * Count of seed messages per original inbox folder.
 */
export const inboxSeedFolderCounts: Record<string, number> = Object.values(
  inboxSeedFolderMap,
).reduce<Record<string, number>>((acc, folder) => {
  acc[folder] = (acc[folder] ?? 0) + 1;
  return acc;
}, {});
