// ---------------------------------------------------------------------------
// BETA-054 (Issue #1961) — client mailbox merge, count overlay, cursor, broadcast.
// ---------------------------------------------------------------------------

import type { Email, MailFolder, MailLocation } from "@/components/mail/data";
import type {
  MailboxCounts,
  MailboxDescriptor,
  MailboxFlagsPatch,
  MailboxLiveFolder,
} from "@/lib/api";
import type { MailWorkspaceOverlay } from "./workspace";

export const MAILBOX_PAGE_SIZE = 50;
export const MAILBOX_RENDER_CAP = 200;
export const MAILBOX_SYNC_CHANNEL = "stealth_mailbox_sync";
export const MAILBOX_DELTA_INTERVAL_MS = 15_000;

const INBOX_COUNT_FOLDERS = new Set<string>([
  "inbox",
  "pending",
  "requests",
  "priority",
  "verified",
  "encrypted",
]);

export function emptyMailboxCounts(): MailboxCounts {
  return {
    inbox: 0,
    requests: 0,
    sent: 0,
    drafts: 0,
    outbox: 0,
    archive: 0,
    spam: 0,
    trash: 0,
    unread: 0,
    starred: 0,
  };
}

export function mergeMailboxDescriptors(
  existing: MailboxDescriptor[],
  incoming: MailboxDescriptor[],
  deletedIds: string[] = [],
): MailboxDescriptor[] {
  const map = new Map(existing.map((item) => [item.messageId, item]));
  for (const id of deletedIds) map.delete(id);
  for (const item of incoming) {
    if (item.isTombstone) map.delete(item.messageId);
    else map.set(item.messageId, item);
  }
  return [...map.values()].sort((a, b) => {
    const byTime = b.createdAt.localeCompare(a.createdAt);
    return byTime !== 0 ? byTime : b.messageId.localeCompare(a.messageId);
  });
}

export function capMailboxWindow(
  items: MailboxDescriptor[],
  cap = MAILBOX_RENDER_CAP,
): MailboxDescriptor[] {
  return items.length <= cap ? items : items.slice(0, cap);
}

export function syncCursorStorageKey(actor: string): string {
  return `stealth.mailbox.syncCursor.${actor}`;
}

export function readSyncCursor(actor: string): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(syncCursorStorageKey(actor));
  } catch {
    return null;
  }
}

export function writeSyncCursor(actor: string, cursor: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(syncCursorStorageKey(actor), cursor);
  } catch {
    // Ignore quota / private-mode failures; the next full sync still works.
  }
}

export function claimMailboxMutation(pending: Set<string>, key: string): boolean {
  if (pending.has(key)) return false;
  pending.add(key);
  return true;
}

export function mailboxMutationKey(messageId: string, patch: MailboxFlagsPatch): string {
  if (patch.folder === "archive") return `${messageId}:archive`;
  if (patch.folder === "trash") return `${messageId}:trash`;
  if (patch.starred !== undefined) return `${messageId}:star`;
  if (patch.unread !== undefined) return `${messageId}:read`;
  if (patch.folder) return `${messageId}:folder:${patch.folder}`;
  return `${messageId}:patch`;
}

export function emailPatchFromFlags(patch: MailboxFlagsPatch): Partial<Email> {
  const next: Partial<Email> = {};
  if (patch.unread !== undefined) next.unread = patch.unread;
  if (patch.starred !== undefined) next.starred = patch.starred;
  if (patch.folder) next.folder = patch.folder as MailLocation;
  return next;
}

export function flagsPatchFromEmail(patch: Partial<Email>): MailboxFlagsPatch | null {
  const flags: MailboxFlagsPatch = {};
  if (patch.unread !== undefined) flags.unread = patch.unread;
  if (patch.starred !== undefined) flags.starred = patch.starred;
  if (
    patch.folder === "archive" ||
    patch.folder === "inbox" ||
    patch.folder === "spam" ||
    patch.folder === "trash"
  ) {
    flags.folder = patch.folder;
  }
  if (flags.unread === undefined && flags.starred === undefined && flags.folder === undefined) {
    return null;
  }
  return flags;
}

type CountableMail = Pick<Email, "folder" | "unread" | "starred">;

function contributeCounts(
  counts: MailboxCounts,
  email: CountableMail,
  delta: 1 | -1,
): MailboxCounts {
  const next = { ...counts };
  const bump = (key: keyof MailboxCounts) => {
    next[key] = Math.max(0, next[key] + delta);
  };

  if (email.folder === "trash") {
    bump("trash");
    return next;
  }
  if (INBOX_COUNT_FOLDERS.has(email.folder)) bump("inbox");
  if (email.folder === "requests") bump("requests");
  if (email.folder === "sent") bump("sent");
  if (email.folder === "drafts") bump("drafts");
  if (email.folder === "outbox") bump("outbox");
  if (email.folder === "archive") bump("archive");
  if (email.folder === "spam") bump("spam");
  if (email.unread && email.folder !== "spam") bump("unread");
  if (email.starred) bump("starred");
  return next;
}

export function applyOverlayToCounts(
  counts: MailboxCounts,
  overlay: MailWorkspaceOverlay,
  serverEmails: Email[],
): MailboxCounts {
  const byId = new Map(serverEmails.map((email) => [email.id, email]));
  let next = { ...counts };

  for (const insert of overlay.inserts) {
    if (!byId.has(insert.id)) {
      next = contributeCounts(next, insert, 1);
    }
  }

  for (const [id, patch] of Object.entries(overlay.patches)) {
    const before = byId.get(id);
    if (!before) continue;
    const after = { ...before, ...patch };
    next = contributeCounts(next, before, -1);
    next = contributeCounts(next, after, 1);
  }

  return next;
}

export function mergeLiveFolderCounts(
  local: Record<MailFolder, number>,
  live?: MailboxCounts | null,
): Record<MailFolder, number> {
  if (!live) return local;
  return {
    ...local,
    inbox: live.inbox,
    requests: live.requests,
    sent: live.sent,
    drafts: live.drafts,
    outbox: live.outbox,
    archive: live.archive,
    spam: live.spam,
    trash: live.trash,
    starred: live.starred,
  };
}

export type MailboxBroadcast =
  | {
      type: "MAILBOX_MUTATION";
      actor: string;
      tabId: string;
      descriptor: MailboxDescriptor;
    }
  | {
      type: "MAILBOX_INVALIDATE";
      actor: string;
      tabId: string;
    };

function firstHeaderString(
  headers: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = headers[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Stable conversation id from trusted envelope headers, else sender+recipient+subject. */
export function threadIdFromDescriptor(descriptor: MailboxDescriptor): string {
  const headers = descriptor.protectedHeaders ?? {};
  const explicit = firstHeaderString(headers, [
    "threadId",
    "thread-id",
    "Thread-Id",
    "inReplyTo",
    "In-Reply-To",
  ]);
  if (explicit) return explicit;
  const subject = firstHeaderString(headers, ["subject", "Subject"]) ?? "";
  const normalized = subject
    .replace(/^(re|fwd|fw):\s*/gi, "")
    .trim()
    .toLowerCase();
  const participants = [descriptor.senderId, descriptor.recipientId]
    .map((value) => value.toUpperCase().trim())
    .sort()
    .join(":");
  return `thread:${participants}:${normalized || descriptor.messageId}`;
}

export function descriptorFolder(descriptor: MailboxDescriptor): MailLocation {
  if (descriptor.isTombstone) return "trash";
  const folder = descriptor.folder as MailboxLiveFolder | undefined;
  if (folder === "pending") return "pending";
  if (folder === "requests") return "requests";
  if (folder === "archive") return "archive";
  if (folder === "spam") return "spam";
  if (folder === "trash") return "trash";
  if (folder === "sent") return "sent";
  if (folder === "drafts") return "drafts";
  if (folder === "outbox") return "outbox";
  if (folder === "inbox") return "inbox";
  return descriptor.status === "pending" ? "pending" : "inbox";
}
