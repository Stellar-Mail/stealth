// ---------------------------------------------------------------------------
// Issue #1972 (BETA-065) — Client Search API & Local Plaintext Search Index
//
// Manages:
// 1. Client search history in localStorage with user controls (add, delete, clear).
// 2. Client-derived local search over decrypted email subjects and bodies.
// 3. Merging server-side metadata results with local decrypted plaintext matches.
// ---------------------------------------------------------------------------

import type { Email } from "@/components/mail/data";
import type { SearchResultItemDto } from "@/lib/api";
import { parseSearchQuery, computeHighlights, type ParsedSearchQuery } from "./searchUtils";

const HISTORY_STORAGE_PREFIX = "stealth:search_history:";
const MAX_HISTORY_ITEMS = 10;

/**
 * Reads the client's search history from localStorage for the given actor.
 */
export function getSearchHistory(actor: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const key = `${HISTORY_STORAGE_PREFIX}${actor ?? "anonymous"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
      : [];
  } catch {
    return [];
  }
}

/**
 * Saves a new query to the search history, deduplicating and maintaining MRU order.
 */
export function addSearchHistory(actor: string | null, query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed || typeof window === "undefined") return getSearchHistory(actor);
  try {
    const existing = getSearchHistory(actor);
    const updated = [
      trimmed,
      ...existing.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, MAX_HISTORY_ITEMS);
    const key = `${HISTORY_STORAGE_PREFIX}${actor ?? "anonymous"}`;
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return getSearchHistory(actor);
  }
}

/**
 * Removes an individual query item from search history.
 */
export function removeSearchHistory(actor: string | null, query: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const existing = getSearchHistory(actor);
    const updated = existing.filter((item) => item.toLowerCase() !== query.trim().toLowerCase());
    const key = `${HISTORY_STORAGE_PREFIX}${actor ?? "anonymous"}`;
    localStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch {
    return getSearchHistory(actor);
  }
}

/**
 * Clears all search history for the actor.
 */
export function clearSearchHistory(actor: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const key = `${HISTORY_STORAGE_PREFIX}${actor ?? "anonymous"}`;
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failure
  }
}

/**
 * Performs local client-side search across loaded/decrypted emails
 * (matching decrypted body text, subject, preview, sender, labels).
 */
export function searchLocalEmails(
  emails: Email[],
  parsed: ParsedSearchQuery,
): SearchResultItemDto[] {
  if (
    !parsed.textQuery &&
    !parsed.filters.folder &&
    parsed.filters.unread === undefined &&
    parsed.filters.starred === undefined
  ) {
    return [];
  }

  const results: SearchResultItemDto[] = [];
  const tokens = parsed.tokens;

  for (const email of emails) {
    // Apply filters
    if (
      parsed.filters.folder &&
      parsed.filters.folder !== "all" &&
      email.folder !== parsed.filters.folder
    ) {
      continue;
    }
    if (parsed.filters.unread !== undefined && email.unread !== parsed.filters.unread) {
      continue;
    }
    if (parsed.filters.starred !== undefined && email.starred !== parsed.filters.starred) {
      continue;
    }
    if (parsed.filters.hasAttachments && (!email.attachments || email.attachments.length === 0)) {
      continue;
    }
    if (parsed.filters.sender) {
      const normSender = parsed.filters.sender.toLowerCase();
      const match =
        email.from.toLowerCase().includes(normSender) ||
        email.email.toLowerCase().includes(normSender);
      if (!match) continue;
    }

    // Match text tokens against local plaintext (subject, body, preview, sender, labels)
    if (tokens.length > 0) {
      const haystack = [
        email.subject,
        email.body,
        email.preview,
        email.from,
        email.email,
        ...(email.labels ?? []),
      ]
        .join(" ")
        .toLowerCase();

      const allTokensMatch = tokens.every((token) => haystack.includes(token.toLowerCase()));
      if (!allTokensMatch) {
        continue;
      }
    }

    const highlights = computeHighlights(
      {
        subject: email.subject,
        body: email.body,
        preview: email.preview,
        from: email.from,
        email: email.email,
      },
      tokens,
    );

    results.push({
      type: "message",
      id: email.id,
      messageId: email.id,
      senderId: email.email,
      recipientId: "me",
      folder: email.folder,
      subject: email.subject,
      preview: email.preview || (email.body ? email.body.slice(0, 100) : "Decrypted message"),
      createdAt: new Date().toISOString(), // Local fallback timestamp
      unread: email.unread,
      starred: email.starred,
      hasAttachments: Boolean(email.attachments && email.attachments.length > 0),
      isTombstone: email.folder === "trash",
      highlights,
    });
  }

  return results;
}

/**
 * Merges server-side metadata search results with local decrypted plaintext matches,
 * deduplicating by ID and prioritizing high-relevance matches.
 */
export function mergeSearchResults(
  serverItems: SearchResultItemDto[],
  localEmails: Email[],
  rawQuery: string,
): SearchResultItemDto[] {
  const parsed = parseSearchQuery(rawQuery);
  const localItems = searchLocalEmails(localEmails, parsed);

  const seenIds = new Set<string>();
  const merged: SearchResultItemDto[] = [];

  // Local decrypted matches are rich in body/subject plaintext
  for (const item of localItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  // Add server metadata items that weren't in local decrypted cache
  for (const item of serverItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      merged.push(item);
    }
  }

  return merged;
}
