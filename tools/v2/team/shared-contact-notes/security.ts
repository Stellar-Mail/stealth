/**
 * security.ts — hardening helpers for the Shared Contact Notes tool (#657).
 *
 * Adds explicit handling for malformed / hostile input and guards against
 * unnecessary work on large histories, per the issue acceptance criteria. This
 * module is ADDITIVE: the existing `validation.ts` / `service.ts` are not
 * modified; callers opt into the hardened path via `hardenCreateNote` /
 * `hardenUpdateNote` / `boundedNotes`.
 *
 * Unsafe inputs addressed:
 *  - Oversized note content (memory/rendering DoS)
 *  - Control characters / NUL bytes smuggled in text fields
 *  - Oversized or non-string identifiers (parsing/lookup abuse)
 *  - Unbounded `getByContact` result sets on large contact histories
 */

import type { CreateNoteInput, Note, UpdateNoteInput } from "./types";

/** Hard limits derived from threat assumptions (see docs/SECURITY.md). */
export const MAX_NOTE_CONTENT_CHARS = 10_000;
export const MAX_IDENTIFIER_CHARS = 256;
export const MAX_NOTES_PER_CONTACT = 1_000;

/** Characters below 0x20 (except TAB/ LF/ CR) are unsafe in stored text. */
function isControlChar(codePoint: number): boolean {
  return codePoint < 0x20 && codePoint !== 0x09 && codePoint !== 0x0a && codePoint !== 0x0d;
}

/** Strip control characters; collapse runs of whitespace. Pure, no allocation of side effects. */
export function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (isControlChar(code)) continue;
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Clamp a string to a maximum length, preserving prefix. */
export function clampLength(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}

export type HardenIssue = { field: string; message: string };

/**
 * Hardened create-path: sanitize every field and report issues for inputs that
 * exceed safe bounds. Returns sanitized input plus any blocking issues. Callers
 * should refuse to persist when `issues.length > 0`.
 */
export function hardenCreateNote(input: CreateNoteInput): {
  value: CreateNoteInput;
  issues: HardenIssue[];
} {
  const issues: HardenIssue[] = [];

  if (typeof input.content !== "string" || input.content.length === 0) {
    issues.push({ field: "content", message: "content is required" });
  }
  if (typeof input.contactId !== "string" || input.contactId.length === 0) {
    issues.push({ field: "contactId", message: "contactId is required" });
  }
  if (typeof input.authorId !== "string" || input.authorId.length === 0) {
    issues.push({ field: "authorId", message: "authorId is required" });
  }

  const content = stripControlChars(input.content ?? "");
  if (content.length > MAX_NOTE_CONTENT_CHARS) {
    issues.push({
      field: "content",
      message: `content exceeds ${MAX_NOTE_CONTENT_CHARS} chars`,
    });
  }

  for (const idField of ["contactId", "authorId"] as const) {
    const raw = input[idField] ?? "";
    if (raw.length > MAX_IDENTIFIER_CHARS) {
      issues.push({
        field: idField,
        message: `${idField} exceeds ${MAX_IDENTIFIER_CHARS} chars`,
      });
    }
  }

  return {
    value: {
      contactId: clampLength(stripControlChars(input.contactId ?? ""), MAX_IDENTIFIER_CHARS),
      authorId: clampLength(stripControlChars(input.authorId ?? ""), MAX_IDENTIFIER_CHARS),
      content: clampLength(content, MAX_NOTE_CONTENT_CHARS),
    },
    issues,
  };
}

/**
 * Hardened update-path: only `content` is mutable. Sanitizes and bounds it.
 */
export function hardenUpdateNote(input: UpdateNoteInput): {
  value: UpdateNoteInput;
  issues: HardenIssue[];
} {
  const issues: HardenIssue[] = [];
  if (input.content === undefined) return { value: {}, issues };

  if (typeof input.content !== "string" || input.content.trim().length === 0) {
    issues.push({ field: "content", message: "content cannot be empty" });
  }
  const content = stripControlChars(input.content);
  if (content.length > MAX_NOTE_CONTENT_CHARS) {
    issues.push({
      field: "content",
      message: `content exceeds ${MAX_NOTE_CONTENT_CHARS} chars`,
    });
  }
  return {
    value: { content: clampLength(content, MAX_NOTE_CONTENT_CHARS) },
    issues,
  };
}

/**
 * Performance guard: bound the number of notes returned for a contact so a large
 * history cannot force an unbounded scan/render. Returns at most `limit` of the
 * most recently updated notes. Avoids unnecessary work on large datasets (issue
 * acceptance criterion).
 */
export function boundedNotes(notes: Note[], limit = MAX_NOTES_PER_CONTACT): Note[] {
  if (notes.length <= limit) return notes;
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
