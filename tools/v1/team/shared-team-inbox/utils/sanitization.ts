const DANGEROUS_TAGS_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_REGEX = /\s*on\w+\s*=\s*["'][^"']*["']/gi;
const JAVASCRIPT_URI_REGEX = /href\s*=\s*["']\s*javascript:[^"']*["']/gi;

/**
 * Sanitizes raw HTML or text content to eliminate common XSS vectors.
 */
export function sanitizeMessageBody(rawBody: string): string {
  if (!rawBody) return '';

  return rawBody
    .replace(DANGEROUS_TAGS_REGEX, '[REDACTED SCRIPT]')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JAVASCRIPT_URI_REGEX, 'href="#"');
}

/**
 * Sanitizes headers/filenames to prevent header injection or directory traversal.
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 255);
}
