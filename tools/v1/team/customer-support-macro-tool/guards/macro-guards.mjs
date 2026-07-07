/**
 * Security and performance guards for Customer Support Macro Tool.
 *
 * These helpers are pure and folder-local. Future app adapters should run them
 * before creating, updating, searching, importing, exporting, or interpolating
 * macros sourced from users, storage, or mailbox context.
 */

const ALLOWED_CATEGORIES = new Set([
  "greeting",
  "billing",
  "technical",
  "shipping",
  "refund",
  "general",
]);

const MACRO_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const MACRO_GUARD_LIMITS = {
  MAX_MACRO_ID_LENGTH: 96,
  MAX_TITLE_LENGTH: 120,
  MAX_BODY_LENGTH: 4_000,
  MAX_TAG_COUNT: 20,
  MAX_TAG_LENGTH: 48,
  MAX_VARIABLE_COUNT: 50,
  MAX_VARIABLE_NAME_LENGTH: 64,
  MAX_VARIABLE_VALUE_LENGTH: 1_000,
  MAX_SEARCH_QUERY_LENGTH: 120,
  MAX_MACRO_BATCH_SIZE: 500,
  MAX_ATTACHMENT_COUNT: 25,
  MAX_ATTACHMENT_NAME_LENGTH: 180,
  MAX_ATTACHMENT_BYTES: 10_000_000,
  MAX_HISTORY_EVENTS: 500,
};

const CONTROL_CHARACTERS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
const INVISIBLE_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g;
const HTML_TAGS = /<[^>]*>/g;

export class MacroGuardError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "MacroGuardError";
    this.field = field;
  }
}

export function sanitizeMacroText(value, maxLength = MACRO_GUARD_LIMITS.MAX_BODY_LENGTH) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .normalize("NFC")
    .replace(HTML_TAGS, "")
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVISIBLE_CHARACTERS, "")
    .trim()
    .slice(0, maxLength);
}

export function validateMacroId(id) {
  if (typeof id !== "string" || id.length === 0) {
    throw new MacroGuardError("macro id must be a non-empty string", "id");
  }
  if (id.length > MACRO_GUARD_LIMITS.MAX_MACRO_ID_LENGTH) {
    throw new MacroGuardError(
      `macro id exceeds ${MACRO_GUARD_LIMITS.MAX_MACRO_ID_LENGTH} characters`,
      "id",
    );
  }
  if (!MACRO_ID_PATTERN.test(id)) {
    throw new MacroGuardError(
      "macro id may contain only letters, numbers, underscore, and dash",
      "id",
    );
  }
  return id;
}

export function validateMacroCategory(category) {
  if (typeof category !== "string" || category.length === 0) {
    throw new MacroGuardError("category must be a non-empty string", "category");
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new MacroGuardError(`unsupported macro category: ${category}`, "category");
  }
  return category;
}

export function validateTags(tags = []) {
  if (!Array.isArray(tags)) {
    throw new MacroGuardError("tags must be an array", "tags");
  }
  if (tags.length > MACRO_GUARD_LIMITS.MAX_TAG_COUNT) {
    throw new MacroGuardError(
      `tag count ${tags.length} exceeds ${MACRO_GUARD_LIMITS.MAX_TAG_COUNT}`,
      "tags",
    );
  }

  const sanitized = [];
  for (const tag of tags) {
    const cleaned = sanitizeMacroText(tag, MACRO_GUARD_LIMITS.MAX_TAG_LENGTH).toLowerCase();
    if (cleaned.length === 0) {
      throw new MacroGuardError("tags must contain visible text", "tags");
    }
    sanitized.push(cleaned);
  }
  return sanitized;
}

export function sanitizeMacroInput(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new MacroGuardError("macro input must be a plain object", "input");
  }

  const title = sanitizeMacroText(input.title, MACRO_GUARD_LIMITS.MAX_TITLE_LENGTH);
  const body = sanitizeMacroText(input.body, MACRO_GUARD_LIMITS.MAX_BODY_LENGTH);

  if (title.length === 0) {
    throw new MacroGuardError("title must contain visible text", "title");
  }
  if (body.length === 0) {
    throw new MacroGuardError("body must contain visible text", "body");
  }

  return {
    title,
    body,
    category: validateMacroCategory(input.category),
    tags: validateTags(input.tags ?? []),
  };
}

export function validateVariableMap(variables = {}) {
  if (variables === null || typeof variables !== "object" || Array.isArray(variables)) {
    throw new MacroGuardError("variables must be a plain object", "variables");
  }

  const entries = Object.entries(variables);
  if (entries.length > MACRO_GUARD_LIMITS.MAX_VARIABLE_COUNT) {
    throw new MacroGuardError(
      `variable count ${entries.length} exceeds ${MACRO_GUARD_LIMITS.MAX_VARIABLE_COUNT}`,
      "variables",
    );
  }

  const sanitized = {};
  for (const [key, value] of entries) {
    if (
      key.length > MACRO_GUARD_LIMITS.MAX_VARIABLE_NAME_LENGTH ||
      !VARIABLE_NAME_PATTERN.test(key)
    ) {
      throw new MacroGuardError(`invalid variable name: ${key}`, "variables");
    }
    sanitized[key] = sanitizeMacroText(value, MACRO_GUARD_LIMITS.MAX_VARIABLE_VALUE_LENGTH);
  }
  return sanitized;
}

export function sanitizeStoredMacro(macro) {
  if (macro === null || typeof macro !== "object" || Array.isArray(macro)) {
    throw new MacroGuardError("stored macro must be a plain object", "macro");
  }
  if (
    typeof macro.usageCount !== "number" ||
    macro.usageCount < 0 ||
    !Number.isFinite(macro.usageCount)
  ) {
    throw new MacroGuardError("usageCount must be a non-negative finite number", "usageCount");
  }
  if (typeof macro.isFavorite !== "boolean") {
    throw new MacroGuardError("isFavorite must be boolean", "isFavorite");
  }

  const input = sanitizeMacroInput(macro);
  return {
    id: validateMacroId(macro.id),
    ...input,
    createdAt: validateIsoTimestamp(macro.createdAt, "createdAt"),
    updatedAt: validateIsoTimestamp(macro.updatedAt, "updatedAt"),
    usageCount: macro.usageCount,
    isFavorite: macro.isFavorite,
  };
}

export function validateIsoTimestamp(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new MacroGuardError(`${field} must be an ISO timestamp string`, field);
  }
  if (Number.isNaN(Date.parse(value))) {
    throw new MacroGuardError(`${field} must be parseable as a date`, field);
  }
  return value;
}

export function guardMacroBatch(macros) {
  if (!Array.isArray(macros)) {
    throw new MacroGuardError("macros must be an array", "macros");
  }
  if (macros.length > MACRO_GUARD_LIMITS.MAX_MACRO_BATCH_SIZE) {
    throw new MacroGuardError(
      `macro batch size ${macros.length} exceeds ${MACRO_GUARD_LIMITS.MAX_MACRO_BATCH_SIZE}; paginate before scanning`,
      "macros",
    );
  }
  return macros.map((macro) => sanitizeStoredMacro(macro));
}

export function guardSearchOptions(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new MacroGuardError("search options must be a plain object", "search");
  }

  const query =
    options.query === undefined
      ? ""
      : sanitizeMacroText(options.query, MACRO_GUARD_LIMITS.MAX_SEARCH_QUERY_LENGTH);

  return {
    query,
    category: options.category === undefined ? undefined : validateMacroCategory(options.category),
    tags: validateTags(options.tags ?? []),
    favoritesOnly: Boolean(options.favoritesOnly),
  };
}

export function guardAttachmentMetadata(attachments = []) {
  if (!Array.isArray(attachments)) {
    throw new MacroGuardError("attachments must be an array", "attachments");
  }
  if (attachments.length > MACRO_GUARD_LIMITS.MAX_ATTACHMENT_COUNT) {
    throw new MacroGuardError(
      `attachment count ${attachments.length} exceeds ${MACRO_GUARD_LIMITS.MAX_ATTACHMENT_COUNT}`,
      "attachments",
    );
  }

  return attachments.map((attachment, index) => {
    if (attachment === null || typeof attachment !== "object" || Array.isArray(attachment)) {
      throw new MacroGuardError(`attachment ${index} must be a plain object`, "attachments");
    }
    if ("content" in attachment || "bytes" in attachment || "buffer" in attachment) {
      throw new MacroGuardError(
        "attachment content is out of scope; pass metadata only",
        "attachments",
      );
    }
    const name = sanitizeMacroText(attachment.name, MACRO_GUARD_LIMITS.MAX_ATTACHMENT_NAME_LENGTH);
    if (name.length === 0) {
      throw new MacroGuardError("attachment name must contain visible text", "attachments");
    }
    if (!Number.isInteger(attachment.sizeBytes) || attachment.sizeBytes < 0) {
      throw new MacroGuardError(
        "attachment sizeBytes must be a non-negative integer",
        "attachments",
      );
    }
    if (attachment.sizeBytes > MACRO_GUARD_LIMITS.MAX_ATTACHMENT_BYTES) {
      throw new MacroGuardError(
        `attachment exceeds ${MACRO_GUARD_LIMITS.MAX_ATTACHMENT_BYTES} bytes`,
        "attachments",
      );
    }
    return { name, sizeBytes: attachment.sizeBytes };
  });
}

export function guardHistoryWindow(events = []) {
  if (!Array.isArray(events)) {
    throw new MacroGuardError("history events must be an array", "history");
  }
  if (events.length > MACRO_GUARD_LIMITS.MAX_HISTORY_EVENTS) {
    throw new MacroGuardError(
      `history size ${events.length} exceeds ${MACRO_GUARD_LIMITS.MAX_HISTORY_EVENTS}; request a smaller window`,
      "history",
    );
  }
  return true;
}

export { ALLOWED_CATEGORIES };
