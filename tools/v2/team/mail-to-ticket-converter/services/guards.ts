export const MAX_STRING_LENGTH = 10000;
export const MAX_SUBJECT_LENGTH = 255;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates that a string is defined and does not exceed the maximum allowed length.
 * Also performs basic sanitization by trimming whitespace and stripping obvious script tags.
 */
export function sanitizeAndValidateString(
  input: string | undefined | null,
  fieldName: string,
  maxLength: number = MAX_STRING_LENGTH,
): string {
  if (input === undefined || input === null) {
    throw new ValidationError(`Field '${fieldName}' is required.`);
  }

  if (typeof input !== "string") {
    throw new ValidationError(`Field '${fieldName}' must be a string.`);
  }

  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new ValidationError(`Field '${fieldName}' cannot be empty.`);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(
      `Field '${fieldName}' exceeds the maximum length of ${maxLength} characters.`,
    );
  }

  // Basic sanitization against obvious XSS vectors for plain text fields
  // In a real app, use DOMPurify if HTML is expected, or reject if strict plain-text is required.
  const sanitized = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  return sanitized;
}

/**
 * Validates array inputs to prevent processing massive lists synchronously
 */
export function validateArraySize<T>(arr: T[], maxItems: number, context: string): void {
  if (arr.length > maxItems) {
    throw new ValidationError(
      `${context} array size (${arr.length}) exceeds the maximum allowed limit of ${maxItems}.`,
    );
  }
}
