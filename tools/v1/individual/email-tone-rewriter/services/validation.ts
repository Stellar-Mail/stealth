/**
 * Email Tone Rewriter — comprehensive input validation service.
 *
 * Provides thorough validation for draft inputs, tone selections, and
 * configuration options. All functions are pure and deterministic.
 * Returns structured validation results with field-level error details.
 */

import type { RewriteRequest, ToneId } from "./emailToneRewriter";
import { SUPPORTED_TONES } from "./emailToneRewriter";

export interface FieldError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  warnings: string[];
  fieldErrors: Record<string, FieldError[]>;
}

export interface ValidationOptions {
  /** Whether to allow empty subject lines. */
  allowEmptySubject?: boolean;
  /** Maximum allowed subject length. */
  maxSubjectLength?: number;
  /** Maximum allowed body length. */
  maxBodyLength?: number;
  /** Maximum allowed maxWords value. */
  maxWordsLimit?: number;
  /** Whether to check for potentially unsafe content. */
  checkSafety?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  allowEmptySubject: true,
  maxSubjectLength: 200,
  maxBodyLength: 20000,
  maxWordsLimit: 2000,
  checkSafety: true,
};

const UNSAFE_PATTERNS: RegExp[] = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /data:\s*text\/html/i,
  /vbscript\s*:/i,
  /<\s*embed[\s>]/i,
  /<\s*object[\s>]/i,
  /<\s*iframe[\s>]/i,
];

const EXCESSIVE_PUNCTUATION = /[!?]{5,}/g;
const EXCESSIVE_UPPERCASE = /[A-Z]{10,}/g;
const REPEATED_WORDS = /\b(\w+)\s+\1\b/gi;

/**
 * Validates a complete rewrite request and returns structured results.
 */
export function validateDraft(
  draft: Partial<RewriteRequest>,
  options: ValidationOptions = {},
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: FieldError[] = [];
  const warnings: string[] = [];
  const fieldErrors: Record<string, FieldError[]> = {};

  // Subject validation
  if (draft.subject !== undefined) {
    if (typeof draft.subject !== "string") {
      const err: FieldError = {
        field: "subject",
        message: "Subject must be a string.",
        code: "invalid-type",
      };
      errors.push(err);
      addFieldError(fieldErrors, "subject", err);
    } else if (!opts.allowEmptySubject && draft.subject.trim().length === 0) {
      const err: FieldError = {
        field: "subject",
        message: "Subject is required.",
        code: "required",
      };
      errors.push(err);
      addFieldError(fieldErrors, "subject", err);
    } else if (draft.subject.length > opts.maxSubjectLength!) {
      const err: FieldError = {
        field: "subject",
        message: `Subject must not exceed ${opts.maxSubjectLength} characters.`,
        code: "too-long",
      };
      errors.push(err);
      addFieldError(fieldErrors, "subject", err);
    }
  }

  // Body text validation
  if (draft.bodyText === undefined || draft.bodyText === null) {
    const err: FieldError = {
      field: "bodyText",
      message: "Body text is required.",
      code: "required",
    };
    errors.push(err);
    addFieldError(fieldErrors, "bodyText", err);
  } else if (typeof draft.bodyText !== "string") {
    const err: FieldError = {
      field: "bodyText",
      message: "Body text must be a string.",
      code: "invalid-type",
    };
    errors.push(err);
    addFieldError(fieldErrors, "bodyText", err);
  } else if (draft.bodyText.trim().length === 0) {
    const err: FieldError = {
      field: "bodyText",
      message: "Body text cannot be empty.",
      code: "empty",
    };
    errors.push(err);
    addFieldError(fieldErrors, "bodyText", err);
  } else if (draft.bodyText.length > opts.maxBodyLength!) {
    const err: FieldError = {
      field: "bodyText",
      message: `Body text must not exceed ${opts.maxBodyLength} characters.`,
      code: "too-long",
    };
    errors.push(err);
    addFieldError(fieldErrors, "bodyText", err);
  }

  // Tone validation
  if (draft.tone === undefined || draft.tone === null) {
    const err: FieldError = {
      field: "tone",
      message: "Tone is required.",
      code: "required",
    };
    errors.push(err);
    addFieldError(fieldErrors, "tone", err);
  } else if (!SUPPORTED_TONES.includes(draft.tone as ToneId)) {
    const err: FieldError = {
      field: "tone",
      message: `Tone must be one of: ${SUPPORTED_TONES.join(", ")}.`,
      code: "unsupported-value",
    };
    errors.push(err);
    addFieldError(fieldErrors, "tone", err);
  }

  // maxWords validation
  if (draft.maxWords !== undefined && draft.maxWords !== null) {
    if (!Number.isInteger(draft.maxWords)) {
      const err: FieldError = {
        field: "maxWords",
        message: "maxWords must be an integer.",
        code: "invalid-type",
      };
      errors.push(err);
      addFieldError(fieldErrors, "maxWords", err);
    } else if (draft.maxWords < 1) {
      const err: FieldError = {
        field: "maxWords",
        message: "maxWords must be a positive integer.",
        code: "out-of-range",
      };
      errors.push(err);
      addFieldError(fieldErrors, "maxWords", err);
    } else if (draft.maxWords > opts.maxWordsLimit!) {
      const err: FieldError = {
        field: "maxWords",
        message: `maxWords must not exceed ${opts.maxWordsLimit}.`,
        code: "out-of-range",
      };
      errors.push(err);
      addFieldError(fieldErrors, "maxWords", err);
    }
  }

  // Safety checks
  if (opts.checkSafety && draft.bodyText) {
    for (const pattern of UNSAFE_PATTERNS) {
      if (pattern.test(draft.bodyText)) {
        const err: FieldError = {
          field: "bodyText",
          message: "Body text contains potentially unsafe content.",
          code: "unsafe-content",
        };
        errors.push(err);
        addFieldError(fieldErrors, "bodyText", err);
        break;
      }
    }

    if (EXCESSIVE_PUNCTUATION.test(draft.bodyText)) {
      warnings.push("Body text contains excessive punctuation.");
    }

    if (EXCESSIVE_UPPERCASE.test(draft.bodyText)) {
      warnings.push("Body text contains long runs of uppercase characters.");
    }

    if (REPEATED_WORDS.test(draft.bodyText)) {
      warnings.push("Body text contains repeated words.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fieldErrors,
  };
}

function addFieldError(map: Record<string, FieldError[]>, field: string, error: FieldError): void {
  if (!map[field]) {
    map[field] = [];
  }
  map[field].push(error);
}

/**
 * Validates a single field of a draft request.
 * Useful for real-time validation as the user types.
 */
export function validateField(
  field: keyof RewriteRequest,
  value: unknown,
  options: ValidationOptions = {},
): FieldError | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  switch (field) {
    case "subject": {
      if (typeof value !== "string") {
        return {
          field,
          message: "Subject must be a string.",
          code: "invalid-type",
        };
      }
      if (!opts.allowEmptySubject && value.trim().length === 0) {
        return { field, message: "Subject is required.", code: "required" };
      }
      if (value.length > opts.maxSubjectLength!) {
        return {
          field,
          message: `Subject must not exceed ${opts.maxSubjectLength} characters.`,
          code: "too-long",
        };
      }
      return null;
    }

    case "bodyText": {
      if (typeof value !== "string") {
        return {
          field,
          message: "Body text must be a string.",
          code: "invalid-type",
        };
      }
      if (value.trim().length === 0) {
        return { field, message: "Body text cannot be empty.", code: "empty" };
      }
      if (value.length > opts.maxBodyLength!) {
        return {
          field,
          message: `Body text must not exceed ${opts.maxBodyLength} characters.`,
          code: "too-long",
        };
      }
      return null;
    }

    case "tone": {
      if (typeof value !== "string") {
        return {
          field,
          message: "Tone must be a string.",
          code: "invalid-type",
        };
      }
      if (!SUPPORTED_TONES.includes(value as ToneId)) {
        return {
          field,
          message: `Tone must be one of: ${SUPPORTED_TONES.join(", ")}.`,
          code: "unsupported-value",
        };
      }
      return null;
    }

    case "maxWords": {
      if (value === undefined || value === null) return null;
      if (!Number.isInteger(value)) {
        return {
          field,
          message: "maxWords must be an integer.",
          code: "invalid-type",
        };
      }
      if ((value as number) < 1) {
        return {
          field,
          message: "maxWords must be a positive integer.",
          code: "out-of-range",
        };
      }
      if ((value as number) > opts.maxWordsLimit!) {
        return {
          field,
          message: `maxWords must not exceed ${opts.maxWordsLimit}.`,
          code: "out-of-range",
        };
      }
      return null;
    }

    default:
      return {
        field,
        message: `Unknown field: ${field}.`,
        code: "unknown-field",
      };
  }
}

/**
 * Returns true if the draft has all required fields filled.
 */
export function isDraftComplete(draft: Partial<RewriteRequest>): boolean {
  return (
    typeof draft.bodyText === "string" &&
    draft.bodyText.trim().length > 0 &&
    typeof draft.tone === "string" &&
    SUPPORTED_TONES.includes(draft.tone as ToneId)
  );
}

/**
 * Returns a human-readable summary of validation errors.
 */
export function summarizeErrors(result: ValidationResult): string {
  if (result.valid) return "No errors.";
  return result.errors.map((e) => `[${e.field}] ${e.message}`).join("\n");
}

/**
 * Returns the count of errors per field.
 */
export function errorCountByField(result: ValidationResult): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const error of result.errors) {
    counts[error.field] = (counts[error.field] || 0) + 1;
  }
  return counts;
}

/**
 * Returns only critical errors (non-warning, non-info).
 */
export function criticalErrors(result: ValidationResult): FieldError[] {
  const criticalCodes = ["required", "unsafe-content", "unsupported-value"];
  return result.errors.filter((e) => criticalCodes.includes(e.code));
}

/**
 * Checks if a draft has any safety concerns.
 */
export function hasSafetyConcerns(bodyText: string): boolean {
  return UNSAFE_PATTERNS.some((pattern) => pattern.test(bodyText));
}

/**
 * Returns a list of style suggestions for improving the draft.
 */
export function styleSuggestions(bodyText: string): string[] {
  const suggestions: string[] = [];

  if (EXCESSIVE_PUNCTUATION.test(bodyText)) {
    suggestions.push("Consider reducing the use of repeated punctuation marks.");
  }

  if (EXCESSIVE_UPPERCASE.test(bodyText)) {
    suggestions.push("Consider using fewer uppercase words for better readability.");
  }

  if (REPEATED_WORDS.test(bodyText)) {
    suggestions.push("Consider removing repeated words for cleaner text.");
  }

  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) {
    suggestions.push("Consider adding more context to your draft.");
  }
  if (wordCount > 500) {
    suggestions.push("Consider shortening your draft for better readability.");
  }

  return suggestions;
}

/**
 * Returns a normalized draft with trimmed fields and default values.
 */
export function normalizeDraft(draft: Partial<RewriteRequest>): Partial<RewriteRequest> {
  const normalized: Partial<RewriteRequest> = {};

  if (draft.subject !== undefined) {
    normalized.subject = draft.subject.trim();
  }

  if (draft.bodyText !== undefined) {
    normalized.bodyText = draft.bodyText.trim();
  }

  if (draft.tone !== undefined) {
    normalized.tone = draft.tone;
  }

  if (draft.maxWords !== undefined) {
    normalized.maxWords = draft.maxWords;
  }

  return normalized;
}

/**
 * Returns the first error message for a given field, or null.
 */
export function firstErrorFor(result: ValidationResult, field: string): string | null {
  const errors = result.fieldErrors[field];
  if (!errors || errors.length === 0) return null;
  return errors[0].message;
}

/**
 * Returns all error codes present in the validation result.
 */
export function errorCodes(result: ValidationResult): string[] {
  const codes = new Set(result.errors.map((e) => e.code));
  return Array.from(codes);
}
