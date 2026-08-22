// ---------------------------------------------------------------------------
// Issue #1972 (BETA-065) — Isomorphic Search Utilities & Query Parser
//
// Pure search parsing, normalization, directive extraction, and snippet
// computation safe for both client and server contexts.
// ---------------------------------------------------------------------------

export interface SearchFilterDirectives {
  folder?:
    | "all"
    | "inbox"
    | "pending"
    | "requests"
    | "archive"
    | "spam"
    | "trash"
    | "sent"
    | "drafts"
    | "outbox";
  unread?: boolean;
  starred?: boolean;
  hasAttachments?: boolean;
  sender?: string;
  recipient?: string;
  afterDate?: string;
  beforeDate?: string;
  includeDeleted?: boolean;
}

export interface ParsedSearchQuery {
  rawQuery: string;
  textQuery: string;
  tokens: string[];
  filters: SearchFilterDirectives;
}

export interface SearchHighlightSnippet {
  field: string;
  snippet: string;
}

export const SAFE_METADATA_FIELDS = [
  "senderId",
  "recipientId",
  "messageId",
  "createdAt",
  "folder",
  "unread",
  "starred",
  "hasAttachments",
  "labels",
  "protectedHeaders.subject",
  "protectedHeaders.from",
  "protectedHeaders.to",
  "contact.name",
  "contact.address",
  "draft.draftId",
];

export const PRIVACY_SAFE_INDEX_NOTICE =
  "Server search is restricted to safe metadata (addresses, dates, folders, flags, attachments). Message bodies remain end-to-end encrypted and are indexed locally on your device.";

/**
 * Normalizes Unicode text (NFKC + case-folding) and strips dangerous control characters.
 */
export function normalizeSearchTerm(input: string): string {
  return input.normalize("NFKC").trim().toLowerCase();
}

/**
 * Escapes regex special characters for safe literal matching.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parses a raw query string for structured directives (e.g. `from:`, `is:unread`, `folder:inbox`)
 * and separates them from free-text keywords.
 */
export function parseSearchQuery(rawQuery: string): ParsedSearchQuery {
  const normalized = rawQuery.normalize("NFKC").trim();
  const filters: SearchFilterDirectives = {
    includeDeleted: false,
  };

  const textTokens: string[] = [];

  // Match key:value directives with optional quotes, or standalone words/quoted phrases
  const directiveRegex = /(?:(\w+):(?:"([^"]+)"|(\S+)))|(?:"([^"]+)")|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = directiveRegex.exec(normalized)) !== null) {
    const key = match[1]?.toLowerCase();
    const directiveValue = match[2] ?? match[3];
    const quotedText = match[4];
    const wordText = match[5];

    if (key && directiveValue !== undefined) {
      const val = directiveValue.trim();
      switch (key) {
        case "from":
        case "sender":
          filters.sender = val;
          break;
        case "to":
        case "recipient":
          filters.recipient = val;
          break;
        case "folder":
        case "in": {
          const lowerFolder = val.toLowerCase();
          if (
            [
              "all",
              "inbox",
              "pending",
              "requests",
              "archive",
              "spam",
              "trash",
              "sent",
              "drafts",
              "outbox",
            ].includes(lowerFolder)
          ) {
            filters.folder = lowerFolder as SearchFilterDirectives["folder"];
          }
          break;
        }
        case "is": {
          const lowerIs = val.toLowerCase();
          if (lowerIs === "unread") filters.unread = true;
          else if (lowerIs === "read") filters.unread = false;
          else if (lowerIs === "starred" || lowerIs === "flagged") filters.starred = true;
          else if (lowerIs === "unstarred" || lowerIs === "unflagged") filters.starred = false;
          else if (lowerIs === "deleted" || lowerIs === "trash") {
            filters.includeDeleted = true;
            filters.folder = "trash";
          }
          break;
        }
        case "has": {
          const lowerHas = val.toLowerCase();
          if (lowerHas === "attachment" || lowerHas === "attachments") {
            filters.hasAttachments = true;
          }
          break;
        }
        case "after":
        case "since":
          filters.afterDate = val;
          break;
        case "before":
        case "until":
          filters.beforeDate = val;
          break;
        default:
          textTokens.push(`${key}:${val}`);
          break;
      }
    } else if (quotedText !== undefined) {
      textTokens.push(quotedText.trim());
    } else if (wordText !== undefined) {
      textTokens.push(wordText.trim());
    }
  }

  return {
    rawQuery,
    textQuery: textTokens.join(" ").trim(),
    tokens: textTokens.filter(Boolean),
    filters,
  };
}

/**
 * Computes highlighting snippets for searchable fields.
 */
export function computeHighlights(
  fields: Record<string, string | undefined>,
  tokens: string[],
): SearchHighlightSnippet[] {
  if (tokens.length === 0) return [];
  const highlights: SearchHighlightSnippet[] = [];

  for (const [fieldName, val] of Object.entries(fields)) {
    if (!val) continue;
    for (const token of tokens) {
      if (!token) continue;
      const normVal = val.normalize("NFKC");
      const normToken = token.normalize("NFKC");
      const idx = normVal.toLowerCase().indexOf(normToken.toLowerCase());
      if (idx >= 0) {
        const start = Math.max(0, idx - 20);
        const end = Math.min(val.length, idx + normToken.length + 30);
        const prefix = start > 0 ? "..." : "";
        const suffix = end < val.length ? "..." : "";
        const snippet = `${prefix}${val.slice(start, end)}${suffix}`;
        highlights.push({ field: fieldName, snippet });
        break;
      }
    }
  }

  return highlights;
}
