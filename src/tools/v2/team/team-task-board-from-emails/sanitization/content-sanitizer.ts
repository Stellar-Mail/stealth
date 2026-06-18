/**
 * Team Task Board from Emails - Content Sanitizer
 *
 * Sanitizes email content to prevent XSS, injection, and other attacks
 * Requirement 2: Content Sanitization for XSS and Injection Prevention
 */

import type { SanitizationResult, SanitizationOptions } from "../types";

// ============================================================================
// Constants
// ============================================================================

// Dangerous HTML tags (including obfuscated variants)
const DANGEROUS_TAGS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
  /<meta\b[^>]*>/gi,
  /<link\b[^>]*>/gi,
  /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
];

// Event handlers
const EVENT_HANDLERS = /\s*on\w+\s*=\s*["'][^"']*["']/gi;

// Dangerous protocols
const JAVASCRIPT_PROTOCOL = /javascript:/gi;
const DATA_URI = /data:[^,]*,/gi;

// Control characters (excluding newline, tab, carriage return)
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Unicode directional override (visual spoofing)
const UNICODE_BIDI = /[\u202A-\u202E\u2066-\u2069]/g;

// Null bytes
const NULL_BYTES = /\x00/g;

// SQL-like patterns (for escaping)
const SQL_SPECIAL_CHARS = /(['"`\\])/g;

// Excessive whitespace (more than 4 consecutive)
const EXCESSIVE_WHITESPACE = /\s{5,}/g;

// All HTML tags
const HTML_TAGS = /<[^>]*>/g;

// ============================================================================
// Content Sanitizer
// ============================================================================

export class ContentSanitizer {
  /**
   * Sanitizes email content with default options
   */
  static sanitize(content: string, options: SanitizationOptions = {}): SanitizationResult {
    const removed: string[] = [];
    let sanitized = content;
    let modified = false;

    const {
      stripHtml = true,
      removeScripts = true,
      removeUrls = false,
      normalizeWhitespace = true,
      maxLength,
    } = options;

    // Track original length
    const originalLength = sanitized.length;

    // Remove null bytes
    if (sanitized.match(NULL_BYTES)) {
      sanitized = sanitized.replace(NULL_BYTES, "");
      removed.push("null_bytes");
      modified = true;
    }

    // Remove control characters (except \n, \r, \t)
    if (sanitized.match(CONTROL_CHARS)) {
      sanitized = sanitized.replace(CONTROL_CHARS, " ");
      removed.push("control_characters");
      modified = true;
    }

    // Remove Unicode BIDI override characters (visual spoofing)
    if (sanitized.match(UNICODE_BIDI)) {
      sanitized = sanitized.replace(UNICODE_BIDI, "");
      removed.push("unicode_bidi_override");
      modified = true;
    }

    // Remove dangerous scripts and tags
    if (removeScripts) {
      for (const pattern of DANGEROUS_TAGS) {
        if (sanitized.match(pattern)) {
          sanitized = sanitized.replace(pattern, "");
          removed.push("dangerous_tags");
          modified = true;
        }
      }

      // Remove event handlers
      if (sanitized.match(EVENT_HANDLERS)) {
        sanitized = sanitized.replace(EVENT_HANDLERS, "");
        removed.push("event_handlers");
        modified = true;
      }

      // Remove javascript: protocol
      if (sanitized.match(JAVASCRIPT_PROTOCOL)) {
        sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL, "");
        removed.push("javascript_protocol");
        modified = true;
      }

      // Remove data URIs
      if (sanitized.match(DATA_URI)) {
        sanitized = sanitized.replace(DATA_URI, "");
        removed.push("data_uri");
        modified = true;
      }
    }

    // Strip all HTML tags
    if (stripHtml) {
      if (sanitized.match(HTML_TAGS)) {
        sanitized = sanitized.replace(HTML_TAGS, "");
        removed.push("html_tags");
        modified = true;
      }
    }

    // Normalize excessive whitespace
    if (normalizeWhitespace) {
      if (sanitized.match(EXCESSIVE_WHITESPACE)) {
        sanitized = sanitized.replace(EXCESSIVE_WHITESPACE, " ");
        removed.push("excessive_whitespace");
        modified = true;
      }
    }

    // Trim
    sanitized = sanitized.trim();

    // Enforce max length
    if (maxLength && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
      removed.push("truncated");
      modified = true;
    }

    // Check if anything was modified
    if (sanitized.length !== originalLength && !modified) {
      modified = true;
    }

    return {
      sanitized,
      removed: Array.from(new Set(removed)), // Deduplicate
      modified,
    };
  }

  /**
   * Escapes SQL special characters
   */
  static escapeSqlChars(value: string): string {
    return value.replace(SQL_SPECIAL_CHARS, "\\$1");
  }

  /**
   * Sanitizes a snippet for display (max 500 chars)
   */
  static sanitizeSnippet(content: string): string {
    const result = this.sanitize(content, {
      stripHtml: true,
      removeScripts: true,
      normalizeWhitespace: true,
      maxLength: 500,
    });
    return result.sanitized;
  }

  /**
   * Sanitizes email subject line
   */
  static sanitizeSubject(subject: string): string {
    const result = this.sanitize(subject, {
      stripHtml: true,
      removeScripts: true,
      normalizeWhitespace: true,
      maxLength: 998, // RFC 5322 limit
    });
    return result.sanitized;
  }

  /**
   * Sanitizes email body content
   */
  static sanitizeBody(body: string): SanitizationResult {
    return this.sanitize(body, {
      stripHtml: true,
      removeScripts: true,
      normalizeWhitespace: true,
      maxLength: 5_000_000, // 5 MB limit
    });
  }

  /**
   * Checks if content contains suspicious patterns
   */
  static detectSuspiciousPatterns(content: string): {
    isSuspicious: boolean;
    patterns: string[];
  } {
    const patterns: string[] = [];

    // Excessive urgency keywords
    const urgencyKeywords = /\b(URGENT|ASAP|CRITICAL|IMMEDIATE|ACT NOW)\b/gi;
    const urgencyMatches = content.match(urgencyKeywords);
    if (urgencyMatches && urgencyMatches.length > 3) {
      patterns.push("excessive_urgency");
    }

    // Financial terms with urgency
    const financialTerms = /\b(payment|money|wire transfer|account|bank|credit card)\b/gi;
    const hasFinancial = financialTerms.test(content);
    const hasUrgency = urgencyKeywords.test(content);
    if (hasFinancial && hasUrgency) {
      patterns.push("financial_urgency_combination");
    }

    // Excessive capitalization (more than 30% caps)
    const letters = content.replace(/[^a-zA-Z]/g, "");
    const upperCount = (content.match(/[A-Z]/g) || []).length;
    if (letters.length > 0 && upperCount / letters.length > 0.3) {
      patterns.push("excessive_capitalization");
    }

    // Multiple external links
    const linkPattern = /https?:\/\/[^\s]+/g;
    const links = content.match(linkPattern);
    if (links && links.length > 10) {
      patterns.push("excessive_external_links");
    }

    // Obfuscated URLs (spaces in URL)
    if (/https?:\/\/[^\s]*\s+[^\s]+\.[a-z]{2,}/gi.test(content)) {
      patterns.push("obfuscated_urls");
    }

    return {
      isSuspicious: patterns.length > 0,
      patterns,
    };
  }

  /**
   * Removes potentially malicious Unicode characters
   */
  static removeUnsafeUnicode(content: string): string {
    // Remove zero-width characters
    let cleaned = content.replace(/[\u200B-\u200D\uFEFF]/g, "");

    // Remove right-to-left override
    cleaned = cleaned.replace(/[\u202E]/g, "");

    // Remove other format characters
    cleaned = cleaned.replace(/[\u2060-\u206F]/g, "");

    return cleaned;
  }

  /**
   * Validates and sanitizes a filename
   */
  static sanitizeFilename(filename: string): string {
    // Remove path separators
    let cleaned = filename.replace(/[/\\]/g, "");

    // Remove null bytes
    cleaned = cleaned.replace(NULL_BYTES, "");

    // Remove control characters
    cleaned = cleaned.replace(CONTROL_CHARS, "");

    // Limit length
    if (cleaned.length > 255) {
      const ext = cleaned.substring(cleaned.lastIndexOf("."));
      const name = cleaned.substring(0, 255 - ext.length);
      cleaned = name + ext;
    }

    // Remove leading/trailing dots and spaces
    cleaned = cleaned.replace(/^[\s.]+|[\s.]+$/g, "");

    return cleaned || "unnamed";
  }

  /**
   * Detects and removes HTML entity encoding attacks
   */
  static decodeAndSanitize(content: string): string {
    // Decode common HTML entities
    const decoded = content
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&amp;/gi, "&");

    // Sanitize the decoded content
    const result = this.sanitize(decoded);
    return result.sanitized;
  }
}
