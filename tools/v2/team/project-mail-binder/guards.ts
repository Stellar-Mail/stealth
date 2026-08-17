/**
 * Project Mail Binder — Guards
 *
 * Validation, sanitization, and safety helpers for bind/unbind operations.
 * All inputs must pass these guards before any database operation is performed.
 */

/** Maximum threads that can be bound to a project in a single request. */
export const MAX_THREADS_PER_BIND = 20;

/** Maximum projects a single thread can be bound to at once. */
export const MAX_PROJECTS_PER_BIND = 10;

/** Maximum length of the subject preview stored in the bind record. */
export const MAX_SUBJECT_PREVIEW_LEN = 200;

/** UUID v4 format regex. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Strip HTML tags and null bytes from a string before storage. */
const HTML_TAG_REGEX = /<[^>]*>/g;
// Build the null-byte regex at runtime to avoid ESLint `no-control-regex`
const NULL_BYTE_REGEX = new RegExp(String.fromCharCode(0), "g");

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class BindValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BindValidationError";
  }
}

// ---------------------------------------------------------------------------
// UUID helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the value is a well-formed UUID v4.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value.trim());
}

/**
 * Validates a single ID and throws if it is malformed.
 */
function requireUUID(value: unknown, fieldName: string): string {
  if (!isValidUUID(value)) {
    throw new BindValidationError(
      `Invalid ${fieldName}: expected a UUID v4, received ${JSON.stringify(value)}`,
    );
  }
  return (value as string).trim();
}

// ---------------------------------------------------------------------------
// String sanitisation
// ---------------------------------------------------------------------------

/**
 * Strips HTML tags and null bytes from a user-supplied string and trims it to
 * the maximum allowed length. Safe to use for subject previews or labels that
 * will be rendered in a project view.
 */
export function sanitizeDisplayString(raw: unknown, maxLen = MAX_SUBJECT_PREVIEW_LEN): string {
  if (typeof raw !== "string") return "";
  return raw.replace(HTML_TAG_REGEX, "").replace(NULL_BYTE_REGEX, "").trim().slice(0, maxLen);
}

// ---------------------------------------------------------------------------
// Bind request guards
// ---------------------------------------------------------------------------

export type BindRequest = {
  projectId: string;
  threadIds: string[];
  subjectPreview?: string;
};

/**
 * Validates and sanitizes a bind request.
 *
 * - Checks that `projectId` and each `threadId` are valid UUIDs.
 * - Caps the number of threads to `MAX_THREADS_PER_BIND`.
 * - Deduplicates thread IDs.
 * - Sanitizes the optional `subjectPreview` string.
 *
 * @throws BindValidationError on any violation.
 */
export function sanitizeBindRequest(raw: unknown): BindRequest {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new BindValidationError("Bind request must be a plain object.");
  }

  const input = raw as Record<string, unknown>;

  const projectId = requireUUID(input.projectId, "projectId");

  if (!Array.isArray(input.threadIds)) {
    throw new BindValidationError("threadIds must be an array.");
  }

  if (input.threadIds.length === 0) {
    throw new BindValidationError("threadIds must contain at least one entry.");
  }

  if (input.threadIds.length > MAX_THREADS_PER_BIND) {
    throw new BindValidationError(
      `Cannot bind more than ${MAX_THREADS_PER_BIND} threads in a single request.`,
    );
  }

  const seen = new Set<string>();
  const threadIds: string[] = [];

  for (const id of input.threadIds) {
    const validated = requireUUID(id, "threadIds[*]");
    if (!seen.has(validated)) {
      seen.add(validated);
      threadIds.push(validated);
    }
  }

  const subjectPreview =
    "subjectPreview" in input ? sanitizeDisplayString(input.subjectPreview) : undefined;

  return { projectId, threadIds, subjectPreview };
}

/**
 * Validates a batch "bind thread to multiple projects" request.
 *
 * - Checks that `threadId` is a valid UUID.
 * - Caps the number of projects to `MAX_PROJECTS_PER_BIND`.
 * - Deduplicates project IDs.
 *
 * @throws BindValidationError on any violation.
 */
export function sanitizeReverseBindRequest(raw: unknown): {
  threadId: string;
  projectIds: string[];
} {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new BindValidationError("Reverse bind request must be a plain object.");
  }

  const input = raw as Record<string, unknown>;

  const threadId = requireUUID(input.threadId, "threadId");

  if (!Array.isArray(input.projectIds)) {
    throw new BindValidationError("projectIds must be an array.");
  }

  if (input.projectIds.length === 0) {
    throw new BindValidationError("projectIds must contain at least one entry.");
  }

  if (input.projectIds.length > MAX_PROJECTS_PER_BIND) {
    throw new BindValidationError(
      `Cannot bind a thread to more than ${MAX_PROJECTS_PER_BIND} projects in a single request.`,
    );
  }

  const seen = new Set<string>();
  const projectIds: string[] = [];

  for (const id of input.projectIds) {
    const validated = requireUUID(id, "projectIds[*]");
    if (!seen.has(validated)) {
      seen.add(validated);
      projectIds.push(validated);
    }
  }

  return { threadId, projectIds };
}
