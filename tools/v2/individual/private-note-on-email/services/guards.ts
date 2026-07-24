import type {
  PrivateNoteAttachmentInput,
  PrivateNoteAttachmentOptions,
  PrivateNoteErrorCode,
  PrivateNoteValidationIssue,
  SafePrivateNoteResult,
} from "../types/privateNoteOnEmail";

export const PRIVATE_NOTE_LIMITS = {
  DEFAULT_MAX_NOTE_LENGTH: 4000,
  MAX_NOTE_LENGTH_LIMIT: 20000,
  DEFAULT_MAX_TAGS: 10,
  MAX_TAGS_LIMIT: 50,
} as const;

export function sanitizeText(text: string, stripHtml: boolean = true): string {
  let cleaned = text || "";
  if (stripHtml) {
    cleaned = cleaned.replace(/<[^>]*>/g, " ");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

export function validatePrivateNoteInput(input: unknown): {
  valid: boolean;
  issues: PrivateNoteValidationIssue[];
} {
  const issues: PrivateNoteValidationIssue[] = [];

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      valid: false,
      issues: [{ field: "input", message: "Input must be a valid non-array object" }],
    };
  }

  const record = input as Record<string, unknown>;

  if (typeof record.requestId !== "string" || !record.requestId.trim()) {
    issues.push({
      field: "requestId",
      message: "requestId is required and must be a non-empty string",
    });
  }

  if (typeof record.emailId !== "string" || !record.emailId.trim()) {
    issues.push({
      field: "emailId",
      message: "emailId is required and must be a non-empty string",
    });
  }

  if (typeof record.noteText !== "string") {
    issues.push({
      field: "noteText",
      message: "noteText is required and must be a string",
    });
  }

  if (record.emailSubject !== undefined && typeof record.emailSubject !== "string") {
    issues.push({
      field: "emailSubject",
      message: "emailSubject must be a string if provided",
    });
  }

  if (record.emailSender !== undefined && typeof record.emailSender !== "string") {
    issues.push({
      field: "emailSender",
      message: "emailSender must be a string if provided",
    });
  }

  if (record.importance !== undefined) {
    const validImportances = ["low", "medium", "high", "urgent"];
    if (!validImportances.includes(record.importance as string)) {
      issues.push({
        field: "importance",
        message: `importance must be one of: ${validImportances.join(", ")}`,
      });
    }
  }

  if (record.visibility !== undefined) {
    const validVisibilities = ["private", "shared_with_team", "confidential"];
    if (!validVisibilities.includes(record.visibility as string)) {
      issues.push({
        field: "visibility",
        message: `visibility must be one of: ${validVisibilities.join(", ")}`,
      });
    }
  }

  if (record.tags !== undefined) {
    if (!Array.isArray(record.tags) || !record.tags.every((t) => typeof t === "string")) {
      issues.push({
        field: "tags",
        message: "tags must be an array of strings if provided",
      });
    }
  }

  if (record.reminderAt !== undefined) {
    if (typeof record.reminderAt !== "string" || isNaN(Date.parse(record.reminderAt))) {
      issues.push({
        field: "reminderAt",
        message: "reminderAt must be a valid ISO date string if provided",
      });
    }
  }

  return { valid: issues.length === 0, issues };
}

export function validatePrivateNoteOptions(options: unknown): {
  valid: boolean;
  issues: PrivateNoteValidationIssue[];
} {
  if (options === undefined || options === null) {
    return { valid: true, issues: [] };
  }

  if (typeof options !== "object" || Array.isArray(options)) {
    return {
      valid: false,
      issues: [{ field: "options", message: "Options must be a valid non-array object" }],
    };
  }

  const issues: PrivateNoteValidationIssue[] = [];
  const record = options as Record<string, unknown>;

  if (record.maxNoteLength !== undefined) {
    if (
      typeof record.maxNoteLength !== "number" ||
      !Number.isInteger(record.maxNoteLength) ||
      record.maxNoteLength < 1 ||
      record.maxNoteLength > PRIVATE_NOTE_LIMITS.MAX_NOTE_LENGTH_LIMIT
    ) {
      issues.push({
        field: "maxNoteLength",
        message: `maxNoteLength must be an integer between 1 and ${PRIVATE_NOTE_LIMITS.MAX_NOTE_LENGTH_LIMIT}`,
      });
    }
  }

  if (record.maxTags !== undefined) {
    if (
      typeof record.maxTags !== "number" ||
      !Number.isInteger(record.maxTags) ||
      record.maxTags < 1 ||
      record.maxTags > PRIVATE_NOTE_LIMITS.MAX_TAGS_LIMIT
    ) {
      issues.push({
        field: "maxTags",
        message: `maxTags must be an integer between 1 and ${PRIVATE_NOTE_LIMITS.MAX_TAGS_LIMIT}`,
      });
    }
  }

  if (record.autoTagKeywords !== undefined && typeof record.autoTagKeywords !== "boolean") {
    issues.push({
      field: "autoTagKeywords",
      message: "autoTagKeywords must be a boolean if provided",
    });
  }

  if (record.stripHtml !== undefined && typeof record.stripHtml !== "boolean") {
    issues.push({
      field: "stripHtml",
      message: "stripHtml must be a boolean if provided",
    });
  }

  return { valid: issues.length === 0, issues };
}

export function sanitizePrivateNoteInput(
  input: PrivateNoteAttachmentInput,
  stripHtml: boolean = true,
): PrivateNoteAttachmentInput {
  const cleanNoteText = sanitizeText(input.noteText, stripHtml);
  const cleanSubject = input.emailSubject ? sanitizeText(input.emailSubject, stripHtml) : undefined;
  const cleanSender = input.emailSender ? sanitizeText(input.emailSender, stripHtml) : undefined;

  const cleanTags = input.tags
    ? input.tags
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, ""),
        )
        .filter((tag) => tag.length > 0)
    : undefined;

  return {
    ...input,
    requestId: input.requestId.trim(),
    emailId: input.emailId.trim(),
    emailSubject: cleanSubject,
    emailSender: cleanSender,
    noteText: cleanNoteText,
    tags: cleanTags,
  };
}

export function checkPrivateNoteInputLimits(
  input: PrivateNoteAttachmentInput,
  options?: PrivateNoteAttachmentOptions,
): {
  ok: boolean;
  code?: PrivateNoteErrorCode;
  message?: string;
  issues?: PrivateNoteValidationIssue[];
} {
  const maxLen = options?.maxNoteLength ?? PRIVATE_NOTE_LIMITS.DEFAULT_MAX_NOTE_LENGTH;
  const maxTags = options?.maxTags ?? PRIVATE_NOTE_LIMITS.DEFAULT_MAX_TAGS;

  if (!input.noteText || input.noteText.trim().length === 0) {
    return {
      ok: false,
      code: "empty-note",
      message: "Private note text is empty or contains only whitespace",
      issues: [{ field: "noteText", message: "noteText cannot be empty" }],
    };
  }

  if (input.noteText.length > maxLen) {
    return {
      ok: false,
      code: "note-too-long",
      message: `Note text length (${input.noteText.length}) exceeds maximum allowed limit (${maxLen})`,
      issues: [{ field: "noteText", message: `noteText exceeds limit of ${maxLen} characters` }],
    };
  }

  if (input.tags && input.tags.length > maxTags) {
    return {
      ok: false,
      code: "too-many-tags",
      message: `Number of tags (${input.tags.length}) exceeds maximum allowed limit (${maxTags})`,
      issues: [{ field: "tags", message: `tags count exceeds limit of ${maxTags}` }],
    };
  }

  return { ok: true };
}
