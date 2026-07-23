/**
 * Security & Sanitization Guards for Deadline Detector
 */

export const MAX_EMAIL_BODY_LENGTH = 50_000; // 50 KB max
export const MAX_BATCH_SIZE = 50;

/**
 * Sanitizes and truncates input text to protect against payload inflation & script injection.
 */
export function sanitizeEmailInput(text: unknown): string {
  if (typeof text !== 'string') return '';

  // 1. Enforce length cap
  let cleaned = text.slice(0, MAX_EMAIL_BODY_LENGTH);

  // 2. Strip potential executable script tags / dangerous HTML controls
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '');

  return cleaned.trim();
}

/**
 * Validates array of email payloads for batch processing limits.
 */
export function validateBatchInput<T>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, MAX_BATCH_SIZE);
}
  
