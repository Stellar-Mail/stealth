// ---------------------------------------------------------------------------
// Issue #1972 (BETA-065) — Server-Backed Mailbox Search Service
//
// Defines privacy-safe server search indexing limited to safe metadata
// (addresses, folders, timestamps, flags, attachments, labels, contacts, drafts).
// Plaintext message bodies are NEVER stored or indexed on the server.
// ---------------------------------------------------------------------------

import type { ApiRepository, Page, SearchMailboxQueryOptions } from "./repository";
import {
  searchQuerySchema,
  type SearchFilter,
  type SearchHighlight,
  type SearchIndexLimitations,
  type SearchQuery,
  type SearchResponse,
  type SearchResultItem,
  type StoredEnvelope,
} from "./domain";

import { readMailboxFlags } from "./mailbox-live";
import { encodeCursor, decodeCursor } from "./pagination";

export const SEARCH_SCOPE = "search";

import {
  SAFE_METADATA_FIELDS,
  PRIVACY_SAFE_INDEX_NOTICE,
  normalizeSearchTerm,
  escapeRegex,
  parseSearchQuery,
  computeHighlights,
  type ParsedSearchQuery,
} from "@/features/mail/searchUtils";

export {
  SAFE_METADATA_FIELDS,
  PRIVACY_SAFE_INDEX_NOTICE,
  normalizeSearchTerm,
  escapeRegex,
  parseSearchQuery,
  computeHighlights,
  type ParsedSearchQuery,
};

/**
 * Maps a StoredEnvelope to a SearchResultItem with computed highlights.
 */
export function envelopeToSearchResult(
  envelope: StoredEnvelope,
  tokens: string[],
): SearchResultItem {
  const flags = readMailboxFlags(envelope);
  const headers = (envelope.protectedHeaders ?? {}) as Record<string, unknown>;
  const subject = typeof headers.subject === "string" ? headers.subject : "Encrypted message";
  const from = typeof headers.from === "string" ? headers.from : envelope.senderId;
  const to = typeof headers.to === "string" ? headers.to : envelope.recipientId;

  const metadata =
    envelope.metadata && typeof envelope.metadata === "object"
      ? (envelope.metadata as Record<string, unknown>)
      : {};
  const attachments = Array.isArray(metadata.attachments) ? metadata.attachments : [];
  const hasAttachments = attachments.length > 0;

  const highlights = computeHighlights(
    {
      subject,
      from,
      to,
      senderId: envelope.senderId,
      recipientId: envelope.recipientId,
      messageId: envelope.messageId,
    },
    tokens,
  );

  return {
    type: "message",
    id: envelope.messageId,
    messageId: envelope.messageId,
    senderId: envelope.senderId,
    recipientId: envelope.recipientId,
    folder: flags.folder,
    subject,
    preview: envelope.deletedAt ? "This message was deleted." : "Encrypted message metadata",
    createdAt: envelope.createdAt,
    unread: flags.unread,
    starred: flags.starred,
    hasAttachments,
    isTombstone: Boolean(envelope.deletedAt),
    deletedAt: envelope.deletedAt ?? null,
    highlights,
  };
}

export async function searchMailboxService(
  repository: ApiRepository,
  actor: string,
  rawQueryInput: Partial<SearchQuery> = {},
): Promise<SearchResponse> {
  const query = searchQuerySchema.parse(rawQueryInput);
  const normActor = actor.toUpperCase().trim();
  const parsed = parseSearchQuery(query.q || "");

  // Merge direct query params with parsed directives
  const folder = query.folder ?? parsed.filters.folder;
  const unread = query.unread ?? parsed.filters.unread;
  const starred = query.starred ?? parsed.filters.starred;
  const hasAttachments = query.hasAttachments ?? parsed.filters.hasAttachments;
  const sender = query.sender ?? parsed.filters.sender;
  const recipient = query.recipient ?? parsed.filters.recipient;
  const afterDate = query.afterDate ?? parsed.filters.afterDate;
  const beforeDate = query.beforeDate ?? parsed.filters.beforeDate;
  const includeDeleted =
    query.includeDeleted || parsed.filters.includeDeleted || folder === "trash";

  let afterKey: string | undefined;
  if (query.cursor) {
    const decoded = decodeCursor(query.cursor, normActor, SEARCH_SCOPE);
    afterKey = decoded.continuationKey;
  }

  const envelopePage: Page<StoredEnvelope> = await repository.searchMailbox(normActor, {
    query: parsed.textQuery || undefined,
    folder,
    unread,
    starred,
    hasAttachments,
    sender,
    recipient,
    afterDate,
    beforeDate,
    includeDeleted,
    limit: query.limit,
    after: afterKey,
  });

  const items: SearchResultItem[] = envelopePage.items.map((env) =>
    envelopeToSearchResult(env, parsed.tokens),
  );

  // Search contacts if not scoped to a message-only folder and on the first page
  if (!query.cursor && (!folder || folder === "all")) {
    try {
      const contactsPage = await repository.listContacts(normActor, {
        query: parsed.textQuery || undefined,
        limit: 5,
      });
      for (const contact of contactsPage.items) {
        const highlights = computeHighlights(
          {
            name: contact.name,
            address: contact.address,
            canonicalAddress: contact.canonicalAddress ?? undefined,
          },
          parsed.tokens,
        );
        items.push({
          type: "contact",
          id: contact.contactId,
          senderId: contact.address,
          recipientId: normActor,
          folder: "contacts",
          subject: contact.name,
          preview: contact.address,
          createdAt: contact.createdAt,
          unread: false,
          starred: false,
          hasAttachments: false,
          isTombstone: false,
          highlights,
        });
      }
    } catch {
      // Non-fatal if contacts listing fails
    }
  }

  // Search drafts if not scoped to an incompatible folder and on the first page
  if (!query.cursor && (!folder || folder === "all" || folder === "drafts")) {
    try {
      const draftsPage = await repository.listDrafts(normActor, {
        limit: 5,
      });
      for (const draft of draftsPage.items) {
        // Draft contents are sealed on the server with AES-256-GCM; metadata is safe
        const highlights = computeHighlights(
          {
            draftId: draft.draftId,
          },
          parsed.tokens,
        );
        // Only include if text tokens match draft metadata or no query
        if (
          !parsed.textQuery ||
          draft.draftId.toLowerCase().includes(parsed.textQuery.toLowerCase())
        ) {
          items.push({
            type: "draft",
            id: draft.draftId,
            senderId: normActor,
            recipientId: normActor,
            folder: "drafts",
            subject: `Draft (${draft.draftId})`,
            preview: "Encrypted draft record",
            createdAt: draft.createdAt,
            unread: false,
            starred: false,
            hasAttachments: false,
            isTombstone: false,
            highlights,
          });
        }
      }
    } catch {
      // Non-fatal if drafts listing fails
    }
  }

  const hasMore = Boolean(envelopePage.nextContinuationKey);
  const nextCursor = envelopePage.nextContinuationKey
    ? encodeCursor(normActor, envelopePage.nextContinuationKey, SEARCH_SCOPE)
    : null;

  const indexLimitations: SearchIndexLimitations = {
    serverIndexLimited: true,
    encryptedBodyIndexed: false,
    safeMetadataFields: SAFE_METADATA_FIELDS,
    notice: PRIVACY_SAFE_INDEX_NOTICE,
  };

  return {
    items,
    nextCursor,
    hasMore,
    totalMatches: items.length,
    query: query.q,
    parsedFilters: {
      folder,
      unread,
      starred,
      hasAttachments,
      sender,
      recipient,
      afterDate,
      beforeDate,
      includeDeleted,
    },
    indexLimitations,
  };
}
