import type { Draft } from "./types/draft";
import type { InboxPreviewItem } from "./types/inboxPreview";

/** Maximum number of characters in the extracted preview line. */
const PREVIEW_MAX_LENGTH = 120;

/**
 * Extract a single-line preview from a draft body.
 *
 * Uses the first non-empty line, capped at `PREVIEW_MAX_LENGTH` characters.
 * Falls back to an empty string when the body is blank.
 */
function extractPreview(body: string): string {
  const firstLine = body.split("\n").find((line) => line.trim().length > 0) ?? "";
  return firstLine.length > PREVIEW_MAX_LENGTH
    ? firstLine.slice(0, PREVIEW_MAX_LENGTH).trimEnd() + "…"
    : firstLine;
}

/**
 * Convert a single admin `Draft` into an `InboxPreviewItem`.
 *
 * The mapping is pure and deterministic: the same draft always produces the
 * same preview item. No clock, random, or network input is used.
 *
 * Limitation: `primaryRecipient` is always the first recipient address.
 * Drafts with an empty recipients list will have an empty `primaryRecipient`.
 * A future inbox integration can filter or enrich this before rendering.
 */
export function toInboxPreviewItem(draft: Draft): InboxPreviewItem {
  return {
    id: draft.id,
    subject: draft.subject,
    preview: extractPreview(draft.body),
    primaryRecipient: draft.recipients[0] ?? "",
    recipients: [...draft.recipients],
  };
}

/**
 * Convert an array of admin `Draft` objects into `InboxPreviewItem` records
 * suitable for populating a demo inbox preview list.
 *
 * The output order mirrors the input order. The function is non-mutating and
 * returns a new array on every call.
 *
 * @example
 * ```ts
 * import { toInboxPreviewData } from "./inboxPreviewAdapter";
 * import { draftSample } from "./fixtures/draftFixtures";
 *
 * const items = toInboxPreviewData([draftSample]);
 * // items[0].preview === "This is a sample draft body for testing."
 * ```
 */
export function toInboxPreviewData(drafts: Draft[]): InboxPreviewItem[] {
  return drafts.map(toInboxPreviewItem);
}
