export const MACRO_SECURITY_LIMITS = {
  maxTags: 12,
  maxTagLength: 40,
  maxSearchableMacros: 250,
};

export type MacroSafetyField = "title" | "body" | "tags";

export type MacroSafetyError = {
  field: MacroSafetyField;
  message: string;
};

export type MacroSafetyInput = {
  title?: string;
  body?: string;
  tags?: string[];
};

export type LimitedMacroList<T> = {
  items: T[];
  truncated: boolean;
};

const INVISIBLE_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function sanitizeMacroText(value: string): string {
  return value
    .replace(INVISIBLE_CONTROL_CHARS, "")
    .replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

export function validateMacroSafety(input: MacroSafetyInput): MacroSafetyError[] {
  const errors: MacroSafetyError[] = [];

  if (input.tags && input.tags.length > MACRO_SECURITY_LIMITS.maxTags) {
    errors.push({ field: "tags", message: "Use 12 tags or fewer." });
  }

  if (input.tags?.some((tag) => tag.trim().length > MACRO_SECURITY_LIMITS.maxTagLength)) {
    errors.push({ field: "tags", message: "Tags must be 40 characters or fewer." });
  }

  return errors;
}

export function limitMacrosForSearch<T>(
  macros: readonly T[],
  limit = MACRO_SECURITY_LIMITS.maxSearchableMacros,
): LimitedMacroList<T> {
  return {
    items: macros.slice(0, limit),
    truncated: macros.length > limit,
  };
}
