/* eslint-disable no-control-regex, no-useless-escape */
/**
 * Content sanitization service for Team Digest Generator
 * Handles sanitization of email content to prevent XSS and injection attacks
 */

import { DigestEmail } from "../types";

/**
 * Sanitize HTML email content
 * Removes dangerous tags, event handlers, and protocols
 */
export function sanitizeEmailContent(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  let sanitized = html;

  // Remove script tags and content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");

  // Remove object tags
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");

  // Remove embed tags
  sanitized = sanitized.replace(/<embed\b[^<]*>/gi, "");

  // Remove form tags
  sanitized = sanitized.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "");

  // Remove input elements
  sanitized = sanitized.replace(/<input\b[^>]*>/gi, "");

  // Remove button elements
  sanitized = sanitized.replace(/<button\b[^>]*>/gi, "");

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, "");

  // Remove dangerous protocols (javascript:, data:, vbscript:)
  sanitized = sanitized.replace(/href\s*=\s*["']?(?:javascript|data|vbscript):/gi, 'href="#"');
  sanitized = sanitized.replace(/src\s*=\s*["']?(?:javascript|data|vbscript):/gi, 'src=""');

  // Remove style attributes (prevent CSS-based attacks)
  sanitized = sanitized.replace(/\s*style\s*=\s*["'][^"']*["']/gi, "");

  return sanitized;
}

/**
 * Sanitize email subject line
 * Removes control characters and handles encoding safely
 */
export function sanitizeEmailSubject(subject: string): string {
  if (!subject || typeof subject !== "string") {
    return "";
  }

  // Remove control characters (U+0000-U+001F, U+007F-U+009F)
  let sanitized = subject.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

  // Truncate to max length
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize sender email address
 */
export function sanitizeSenderEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  // Basic sanitization - trim and limit length
  let sanitized = email.trim();

  const maxLength = 254;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize filename for attachments
 * Prevents path traversal and other attacks
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== "string") {
    return "";
  }

  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, "");

  // Remove null bytes
  sanitized = sanitized.replace(/\x00/g, "");

  // Allow only safe characters: alphanumeric, dots, hyphens, underscores
  // First pass: replace unsafe characters with underscore
  sanitized = sanitized.replace(/[^a-zA-Z0-9._\-]/g, "_");

  // Truncate to max length
  const maxLength = 255;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize a digest email for display
 */
export function sanitizeDigestEmail(email: DigestEmail): DigestEmail {
  return {
    ...email,
    from: sanitizeSenderEmail(email.from),
    subject: sanitizeEmailSubject(email.subject),
    snippet: sanitizeEmailContent(email.snippet),
  };
}

/**
 * Escape HTML special characters for safe display
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
 * Sanitize for JSON output
 * Prevents JSON injection attacks
 */
export function sanitizeForJson(obj: any): string {
  try {
    // JSON.stringify handles most escaping
    return JSON.stringify(obj);
  } catch {
    return "{}";
  }
}

/**
 * Validate attachment metadata
 * Does NOT download or parse attachment content
 */
export interface AttachmentMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ValidatedAttachment {
  filename: string;
  sizeFormatted: string;
  valid: boolean;
  error?: string;
}

/**
 * Validate and sanitize attachment metadata
 */
export function validateAttachment(attachment: AttachmentMetadata): ValidatedAttachment {
  // Check filename
  if (!attachment.filename || typeof attachment.filename !== "string") {
    return {
      filename: "unknown",
      sizeFormatted: "0 B",
      valid: false,
      error: "Invalid filename",
    };
  }

  if (attachment.filename.length > 255) {
    return {
      filename: attachment.filename.substring(0, 50),
      sizeFormatted: "0 B",
      valid: false,
      error: "Filename too long",
    };
  }

  // Check for path traversal
  if (
    attachment.filename.includes("..") ||
    attachment.filename.includes("/") ||
    attachment.filename.includes("\\")
  ) {
    return {
      filename: "unknown",
      sizeFormatted: "0 B",
      valid: false,
      error: "Invalid filename format",
    };
  }

  // Check size
  const maxSizeBytes = 100 * 1024 * 1024; // 100 MB
  if (attachment.sizeBytes > maxSizeBytes) {
    return {
      filename: sanitizeFilename(attachment.filename),
      sizeFormatted: formatBytes(attachment.sizeBytes),
      valid: false,
      error: "File too large (max 100 MB)",
    };
  }

  return {
    filename: sanitizeFilename(attachment.filename),
    sizeFormatted: formatBytes(attachment.sizeBytes),
    valid: true,
  };
}

/**
 * Format bytes as human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Create digest preview with all sanitization applied
 */
export function createSanitizedPreview(emails: DigestEmail[]): Array<{
  from: string;
  subject: string;
  snippet: string;
  hasAttachments: boolean;
}> {
  return emails.map((email) => ({
    from: sanitizeSenderEmail(email.from),
    subject: sanitizeEmailSubject(email.subject),
    snippet: sanitizeEmailContent(email.snippet),
    hasAttachments: email.hasAttachments,
  }));
}
