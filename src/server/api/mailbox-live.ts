// ---------------------------------------------------------------------------
// BETA-054 (Issue #1961) — live mailbox descriptors, folder counts, and sync.
// ---------------------------------------------------------------------------

import type {
  MailboxCounts,
  MailboxDescriptor,
  MailboxFlagsPatch,
  MailboxLiveFolder,
  StoredEnvelope,
} from "./domain";
import { encodeCursor, decodeCursor } from "./pagination";
import { paginate, PAGINATED_QUERY_ORDERINGS, type ApiRepository } from "./repository";

export const MAILBOX_SYNC_SCOPE = "mailbox_sync";
export const MAILBOX_SYNC_PAGE_SCOPE = "mailbox_sync_page";
export const MAILBOX_CURSOR_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const LIST_WALK_PAGE_SIZE = 100;
const LIST_WALK_MAX_PAGES = 40;

const INBOX_COUNT_FOLDERS = new Set<MailboxLiveFolder>(["inbox", "pending", "requests"]);

const LIVE_FOLDERS = new Set<MailboxLiveFolder>([
  "inbox",
  "pending",
  "requests",
  "archive",
  "spam",
  "trash",
  "sent",
  "drafts",
  "outbox",
]);

export interface MailboxLiveFlags {
  starred: boolean;
  unread: boolean;
  folder: MailboxLiveFolder;
  updatedAt: string | null;
}

export interface MailboxSyncPayload {
  items: MailboxDescriptor[];
  deletedIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
  syncCursor: string;
  counts: MailboxCounts;
}

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

function isLiveFolder(value: unknown): value is MailboxLiveFolder {
  return typeof value === "string" && LIVE_FOLDERS.has(value as MailboxLiveFolder);
}

export function readMailboxFlags(envelope: StoredEnvelope): MailboxLiveFlags {
  const metadata = envelope.metadata;
  const raw =
    metadata && typeof metadata === "object" && "mailbox" in metadata
      ? (metadata as Record<string, unknown>).mailbox
      : undefined;
  const mailbox = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const tombstone = Boolean(envelope.deletedAt);
  const defaultFolder: MailboxLiveFolder = tombstone
    ? "trash"
    : envelope.status === "pending"
      ? "pending"
      : "inbox";
  const folder = tombstone
    ? "trash"
    : isLiveFolder(mailbox.folder)
      ? mailbox.folder
      : defaultFolder;
  return {
    starred: typeof mailbox.starred === "boolean" ? mailbox.starred : false,
    unread: typeof mailbox.unread === "boolean" ? mailbox.unread : envelope.status === "pending",
    folder,
    updatedAt: typeof mailbox.updatedAt === "string" ? mailbox.updatedAt : null,
  };
}

export function applyMailboxFlags(
  envelope: StoredEnvelope,
  patch: MailboxFlagsPatch,
  now: string,
): StoredEnvelope {
  const current = readMailboxFlags(envelope);
  const starred = patch.starred ?? current.starred;
  const unread = patch.unread ?? current.unread;
  const folder = patch.folder ?? current.folder;
  const deletedAt = patch.folder === "trash" ? (envelope.deletedAt ?? now) : envelope.deletedAt;
  let status = envelope.status ?? "pending";
  if (patch.unread === false) status = "delivered";
  if (patch.unread === true) status = "pending";

  return {
    ...envelope,
    status,
    deletedAt,
    metadata: {
      ...(envelope.metadata ?? {}),
      mailbox: {
        starred,
        unread,
        folder: deletedAt ? "trash" : folder,
        updatedAt: now,
      },
    },
  };
}

export function readSealedMailboxParts(envelope: StoredEnvelope): {
  payload: unknown;
  ciphertext: string;
  signature: unknown;
} {
  const metadata =
    envelope.metadata && typeof envelope.metadata === "object"
      ? (envelope.metadata as Record<string, unknown>)
      : {};
  const sealedRaw = metadata.sealed;
  if (sealedRaw && typeof sealedRaw === "object") {
    const sealed = sealedRaw as Record<string, unknown>;
    if (sealed.payload !== undefined && typeof sealed.ciphertext === "string") {
      return {
        payload: sealed.payload,
        ciphertext: sealed.ciphertext,
        signature: sealed.signature ?? null,
      };
    }
  }

  const headers = (envelope.protectedHeaders ?? {}) as Record<string, unknown>;
  const payload =
    metadata.payload !== undefined
      ? metadata.payload
      : {
          version: typeof headers.version === "string" ? headers.version : "v1",
          sender: envelope.senderId,
          recipient: envelope.recipientId,
          timestamp: envelope.createdAt,
          encryption_metadata: {
            algorithm: "AES-256-GCM",
            nonce: headers.nonce,
            mac: headers.mac,
            ephemeral_public_key: headers.ephemeral_public_key,
            recipient_key_id: headers.kid,
            sender_key_id: headers.sender_key_id,
          },
          content_commitment: metadata.contentCommitment ?? envelope.contentCommitment,
          attachments: Array.isArray(metadata.attachments) ? metadata.attachments : [],
          wrapped_keys: metadata.wrapped_keys,
        };

  return {
    payload,
    ciphertext: envelope.ciphertext,
    signature: metadata.signature ?? headers.signature ?? null,
  };
}

export function envelopeToSealedMailboxMessage(envelope: StoredEnvelope) {
  const sealed = readSealedMailboxParts(envelope);
  return {
    ...envelopeToMailboxDescriptor(envelope),
    ciphertext: sealed.ciphertext,
    payload: sealed.payload,
    signature: sealed.signature,
  };
}

export function envelopeToMailboxDescriptor(envelope: StoredEnvelope): MailboxDescriptor {
  const flags = readMailboxFlags(envelope);
  return {
    messageId: envelope.messageId,
    senderId: envelope.senderId,
    recipientId: envelope.recipientId,
    status: envelope.status ?? "pending",
    createdAt: envelope.createdAt,
    protectedHeaders: envelope.protectedHeaders,
    contentCommitment: envelope.contentCommitment,
    objectRef: envelope.objectRef,
    isTombstone: Boolean(envelope.deletedAt),
    deletedAt: envelope.deletedAt ?? null,
    starred: flags.starred,
    unread: flags.unread,
    folder: flags.folder,
  };
}

export function countMailbox(envelopes: readonly StoredEnvelope[]): MailboxCounts {
  const counts = emptyMailboxCounts();
  for (const envelope of envelopes) {
    const flags = readMailboxFlags(envelope);
    if (flags.folder === "trash" || envelope.deletedAt) {
      counts.trash += 1;
      continue;
    }
    if (INBOX_COUNT_FOLDERS.has(flags.folder)) counts.inbox += 1;
    if (flags.folder === "requests") counts.requests += 1;
    if (flags.folder === "sent") counts.sent += 1;
    if (flags.folder === "drafts") counts.drafts += 1;
    if (flags.folder === "outbox") counts.outbox += 1;
    if (flags.folder === "archive") counts.archive += 1;
    if (flags.folder === "spam") counts.spam += 1;
    if (flags.unread && flags.folder !== "spam") counts.unread += 1;
    if (flags.starred) counts.starred += 1;
  }
  return counts;
}

export function mailboxChangedSince(envelope: StoredEnvelope, since: string): boolean {
  if (envelope.createdAt > since) return true;
  if (envelope.deletedAt && envelope.deletedAt > since) return true;
  const updatedAt = readMailboxFlags(envelope).updatedAt;
  return Boolean(updatedAt && updatedAt > since);
}

export function maxMailboxTimestamp(
  envelopes: readonly StoredEnvelope[],
  fallback: string,
): string {
  let max: string | null = null;
  for (const envelope of envelopes) {
    for (const value of [
      envelope.createdAt,
      envelope.deletedAt,
      readMailboxFlags(envelope).updatedAt,
    ]) {
      if (value && (max === null || value > max)) max = value;
    }
  }
  return max ?? fallback;
}

export async function listAllRecipientEnvelopes(
  repository: Pick<ApiRepository, "listRecipientEnvelopes">,
  recipient: string,
  includeTombstones = true,
): Promise<StoredEnvelope[]> {
  const items: StoredEnvelope[] = [];
  let after: string | undefined;
  for (let page = 0; page < LIST_WALK_MAX_PAGES; page += 1) {
    const result = await repository.listRecipientEnvelopes(recipient, {
      status: "all",
      includeTombstones,
      limit: LIST_WALK_PAGE_SIZE,
      after,
    });
    items.push(...result.items);
    if (!result.nextContinuationKey) break;
    after = result.nextContinuationKey;
  }
  return items;
}

export async function buildMailboxSync(
  repository: Pick<ApiRepository, "listRecipientEnvelopes">,
  actor: string,
  query: {
    sinceCursor?: string;
    cursor?: string;
    limit?: number;
    cursorMaxAgeMs?: number;
  },
): Promise<MailboxSyncPayload> {
  const limit = query.limit ?? 50;
  const maxAgeMs = query.cursorMaxAgeMs ?? MAILBOX_CURSOR_TTL_MS;
  const all = await listAllRecipientEnvelopes(repository, actor, true);
  const counts = countMailbox(all);
  const syncCursor = encodeCursor(
    actor,
    maxMailboxTimestamp(all, new Date().toISOString()),
    MAILBOX_SYNC_SCOPE,
  );

  const since = query.sinceCursor
    ? decodeCursor(query.sinceCursor, actor, MAILBOX_SYNC_SCOPE, { maxAgeMs }).continuationKey
    : null;
  const filtered = since
    ? all.filter((envelope) => mailboxChangedSince(envelope, since))
    : all.filter((envelope) => !envelope.deletedAt);

  const after = query.cursor
    ? decodeCursor(query.cursor, actor, MAILBOX_SYNC_PAGE_SCOPE, { maxAgeMs }).continuationKey
    : undefined;
  const page = paginate(filtered, PAGINATED_QUERY_ORDERINGS.listEnvelopes, {
    limit,
    after,
  });
  const items = page.items.map(envelopeToMailboxDescriptor);
  const deletedIds = query.sinceCursor
    ? filtered
        .filter((envelope) => Boolean(envelope.deletedAt))
        .map((envelope) => envelope.messageId)
    : [];

  return {
    items,
    deletedIds,
    nextCursor: page.nextContinuationKey
      ? encodeCursor(actor, page.nextContinuationKey, MAILBOX_SYNC_PAGE_SCOPE)
      : null,
    hasMore: Boolean(page.nextContinuationKey),
    syncCursor,
    counts,
  };
}
