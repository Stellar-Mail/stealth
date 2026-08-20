/**
 * Merge live-synced mailbox messages into the inbox list without duplicating
 * seeded demo mail (Issue #1941 BETA-034).
 */
import type { Email } from "@/components/mail/data";

import type { SyncedMailboxMessage } from "./types";

const AVATAR_COLORS = ["#7dd3fc", "#c4b5fd", "#86efac", "#fcd34d", "#f9a8d4"];

function avatarColor(messageId: string): string {
  const n = Number.parseInt(messageId.slice(0, 6), 16);
  return AVATAR_COLORS[(Number.isFinite(n) ? n : 0) % AVATAR_COLORS.length];
}

export function syncedMessageToEmail(message: SyncedMailboxMessage): Email {
  const folder = (message.folder as Email["folder"]) || "inbox";
  return {
    id: message.messageId,
    from: message.sender
      ? `${message.sender.slice(0, 6)}…${message.sender.slice(-4)}`
      : "Encrypted sender",
    email: message.sender ?? message.recipient,
    subject: "Encrypted message",
    preview: "New encrypted mail arrived over live sync.",
    body: "",
    time: message.occurredAt,
    unread: message.unread,
    starred: message.starred,
    folder: folder === "inbox" || folder.length > 0 ? (folder as Email["folder"]) : "inbox",
    avatarColor: avatarColor(message.messageId),
    encryptedPayload: {
      status: "locked",
      diagnosticId: message.messageId.slice(0, 8),
    },
  };
}

export function mergeLiveMailboxMessages(
  current: Email[],
  live: readonly SyncedMailboxMessage[],
): Email[] {
  const liveIds = new Set(live.map((message) => message.messageId));
  const withoutRemoved = current.filter(
    (email) => !/^[a-f0-9]{64}$/.test(email.id) || liveIds.has(email.id),
  );
  const byId = new Map(withoutRemoved.map((email) => [email.id, email]));
  for (const message of live) {
    const next = syncedMessageToEmail(message);
    const existing = byId.get(message.messageId);
    byId.set(message.messageId, existing ? { ...existing, ...next, body: existing.body } : next);
  }
  return [...byId.values()];
}
