/* eslint-disable no-control-regex, no-useless-escape */
/**
 * Sanitization service for Team Calendar Extraction
 * Handles cleaning up inputs to prevent HTML injection and XSS
 */

/**
 * Escape HTML special characters for safe output rendering
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const htmlEscapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

/**
 * Sanitize text inputs by removing control characters and limiting length
 */
export function sanitizeText(text: string, maxLength = 1000): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove control characters (U+0000-U+001F, U+007F-U+009F)
  let sanitized = text.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize HTML content by stripping scripts, iframes, style tags, forms,
 * events handlers, and dangerous URL protocols.
 */
export function sanitizeHtml(html: string): { content: string; actionsTaken: number } {
  if (!html || typeof html !== "string") {
    return { content: "", actionsTaken: 0 };
  }

  let sanitized = html;
  let actionsTaken = 0;

  const patterns = [
    // Remove script tags and content
    { regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, desc: "script tags" },
    // Remove iframe tags and content
    { regex: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, desc: "iframe tags" },
    // Remove object tags and content
    { regex: /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, desc: "object tags" },
    // Remove embed tags
    { regex: /<embed\b[^>]*>/gi, desc: "embed tags" },
    // Remove form elements
    { regex: /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, desc: "form tags" },
    { regex: /<input\b[^>]*>/gi, desc: "input elements" },
    { regex: /<button\b[^>]*>/gi, desc: "button elements" },
    // Remove event handlers
    { regex: /\s*on\w+\s*=\s*["'][^"']*["']/gi, desc: "event handlers quotes" },
    { regex: /\s*on\w+\s*=\s*[^\s>]*/gi, desc: "event handlers unquoted" },
    // Remove style attributes (prevents style injection)
    { regex: /\s*style\s*=\s*["'][^"']*["']/gi, desc: "style attributes" },
  ];

  for (const pattern of patterns) {
    const matches = sanitized.match(pattern.regex);
    if (matches) {
      actionsTaken += matches.length;
      sanitized = sanitized.replace(pattern.regex, "");
    }
  }

  // Sanitize URLs to prevent javascript:, data:, vbscript: protocols
  const protocolRegex =
    /(href|src)\s*=\s*(?:(["'])(?:javascript|data|vbscript):.*?\2|(?:javascript|data|vbscript):[^\s>]*)/gi;
  const protocolMatches = sanitized.match(protocolRegex);
  if (protocolMatches) {
    actionsTaken += protocolMatches.length;
    sanitized = sanitized.replace(protocolRegex, '$1="#"');
  }

  return {
    content: sanitized,
    actionsTaken,
  };
}

/**
 * Sanitize email addresses to standard format, limiting length
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  let sanitized = email.trim().toLowerCase();

  // Remove control characters and spaces
  sanitized = sanitized.replace(/[\s\x00-\x1F\x7F-\x9F]/g, "");

  const maxLength = 254;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize filename to prevent directory traversal and invalid chars
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "unnamed_event.ics";
  }

  // Remove path components (traversal prevention)
  let sanitized = filename.replace(/^.*[\\\/]/, "");

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, "");

  // Replace spaces and special characters with underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._\-]/g, "_");

  // Avoid empty filename or just dots
  if (/^\.*$/.test(sanitized)) {
    sanitized = "safe_name.ics";
  }

  // Truncate length
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
