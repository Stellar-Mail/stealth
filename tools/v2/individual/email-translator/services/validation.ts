/**
 * Email Translator — Input Validation and Sanitization
 *
 * This module provides validation and sanitization utilities for:
 * - Email body text (untrusted user input)
 * - Language codes (ISO 639-1)
 * - Configuration objects (provider settings)
 * - Translation provider responses
 *
 * All functions throw ValidationError or SecurityError on failure.
 */

// @ts-ignore
import DOMPurify from "isomorphic-dompurify";

// ============================================================================
// Custom Error Types
// ============================================================================

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly reason?: string,
  ) {
    super(message);
    this.name = "SecurityError";
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum size for input text (1 MB)
 * Enforced to prevent memory exhaustion and provider API limits
 */
export const MAX_INPUT_SIZE = 1_000_000;

/**
 * Maximum size for provider responses (2 MB)
 * Allows for expansion during translation but prevents DoS
 */
export const MAX_RESPONSE_SIZE = 2_000_000;

/**
 * Minimum text length for language detection
 * Below this threshold, detection is unreliable
 */
export const MIN_DETECTION_LENGTH = 10;

/**
 * ISO 639-1 language codes
 * Exhaustive whitelist of valid two-letter codes
 */
export const VALID_LANGUAGE_CODES = new Set([
  "aa",
  "ab",
  "ae",
  "af",
  "ak",
  "am",
  "an",
  "ar",
  "as",
  "av",
  "ay",
  "az",
  "ba",
  "be",
  "bg",
  "bh",
  "bi",
  "bm",
  "bn",
  "bo",
  "br",
  "bs",
  "ca",
  "ce",
  "ch",
  "co",
  "cr",
  "cs",
  "cu",
  "cv",
  "cy",
  "da",
  "de",
  "dv",
  "dz",
  "ee",
  "el",
  "en",
  "eo",
  "es",
  "et",
  "eu",
  "fa",
  "ff",
  "fi",
  "fj",
  "fo",
  "fr",
  "fy",
  "ga",
  "gd",
  "gl",
  "gn",
  "gu",
  "gv",
  "ha",
  "he",
  "hi",
  "ho",
  "hr",
  "ht",
  "hu",
  "hy",
  "hz",
  "ia",
  "id",
  "ie",
  "ig",
  "ii",
  "ik",
  "io",
  "is",
  "it",
  "iu",
  "ja",
  "jv",
  "ka",
  "kg",
  "ki",
  "kj",
  "kk",
  "kl",
  "km",
  "kn",
  "ko",
  "kr",
  "ks",
  "ku",
  "kv",
  "kw",
  "ky",
  "la",
  "lb",
  "lg",
  "li",
  "ln",
  "lo",
  "lt",
  "lu",
  "lv",
  "mg",
  "mh",
  "mi",
  "mk",
  "ml",
  "mn",
  "mr",
  "ms",
  "mt",
  "my",
  "na",
  "nb",
  "nd",
  "ne",
  "ng",
  "nl",
  "nn",
  "no",
  "nr",
  "nv",
  "ny",
  "oc",
  "oj",
  "om",
  "or",
  "os",
  "pa",
  "pi",
  "pl",
  "ps",
  "pt",
  "qu",
  "rm",
  "rn",
  "ro",
  "ru",
  "rw",
  "sa",
  "sc",
  "sd",
  "se",
  "sg",
  "si",
  "sk",
  "sl",
  "sm",
  "sn",
  "so",
  "sq",
  "sr",
  "ss",
  "st",
  "su",
  "sv",
  "sw",
  "ta",
  "te",
  "tg",
  "th",
  "ti",
  "tk",
  "tl",
  "tn",
  "to",
  "tr",
  "ts",
  "tt",
  "tw",
  "ty",
  "ug",
  "uk",
  "ur",
  "uz",
  "ve",
  "vi",
  "vo",
  "wa",
  "wo",
  "xh",
  "yi",
  "yo",
  "za",
  "zh",
  "zu",
]);

// ============================================================================
// Text Sanitization
// ============================================================================

/**
 * Sanitizes email body text for translation
 *
 * - Enforces size limits
 * - Strips all HTML tags and attributes
 * - Removes control characters (except newlines and tabs)
 * - Normalizes whitespace
 *
 * @param raw - Untrusted email body text
 * @returns Sanitized plaintext
 * @throws {SecurityError} If text exceeds size limit
 * @throws {ValidationError} If input is not a string
 */
export function sanitizeEmailBody(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("Email body must be a string", "body");
  }

  if (raw.length > MAX_INPUT_SIZE) {
    throw new SecurityError(
      `Email body exceeds maximum size of ${MAX_INPUT_SIZE} characters`,
      "size_limit",
    );
  }

  // Strip all HTML (translation should work on plaintext)
  const withoutHtml = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Remove control characters except newlines (\n), carriage returns (\r), tabs (\t)
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = withoutHtml.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  // Normalize excessive whitespace (multiple spaces → single space)
  const normalized = withoutControlChars.replace(/[ \t]+/g, " ");

  return normalized.trim();
}

/**
 * Sanitizes translation provider response
 *
 * Provider responses are untrusted and may contain:
 * - XSS payloads
 * - Tracking pixels
 * - Excessive content
 *
 * @param response - Untrusted provider response
 * @returns Sanitized translation text
 * @throws {SecurityError} If response exceeds size limit or contains only unsafe content
 * @throws {ValidationError} If response is not a string
 */
export function sanitizeProviderResponse(response: unknown): string {
  if (typeof response !== "string") {
    throw new ValidationError("Provider response must be a string", "response");
  }

  if (response.length > MAX_RESPONSE_SIZE) {
    throw new SecurityError(
      `Provider response exceeds maximum size of ${MAX_RESPONSE_SIZE} characters`,
      "response_size_limit",
    );
  }

  // Strip all HTML (including potential XSS vectors)
  const sanitized = DOMPurify.sanitize(response, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // If sanitization removed everything, the response was entirely unsafe
  if (sanitized.length === 0 && response.length > 0) {
    throw new SecurityError("Provider response contained only unsafe content", "unsafe_content");
  }

  return sanitized.trim();
}

// ============================================================================
// Language Code Validation
// ============================================================================

/**
 * Validates a language code against ISO 639-1 whitelist
 *
 * @param code - Alleged language code
 * @returns True if valid
 */
export function isValidLanguageCode(code: unknown): code is string {
  return (
    typeof code === "string" &&
    code.length === 2 &&
    /^[a-z]{2}$/.test(code) &&
    VALID_LANGUAGE_CODES.has(code)
  );
}

/**
 * Sanitizes and validates a language code
 *
 * - Converts to lowercase
 * - Trims whitespace
 * - Validates against whitelist
 *
 * @param code - Untrusted language code
 * @returns Validated ISO 639-1 code
 * @throws {ValidationError} If code is invalid
 */
export function sanitizeLanguageCode(code: unknown): string {
  if (typeof code !== "string") {
    throw new ValidationError("Language code must be a string", "languageCode");
  }

  const normalized = code.toLowerCase().trim().slice(0, 2);

  if (!isValidLanguageCode(normalized)) {
    throw new ValidationError(
      `Invalid language code: "${code}". Must be a valid ISO 639-1 code.`,
      "languageCode",
    );
  }

  return normalized;
}

/**
 * Validates source and target language codes
 *
 * @param from - Source language code
 * @param to - Target language code
 * @throws {ValidationError} If codes are invalid or identical
 */
export function validateLanguagePair(from: unknown, to: unknown): void {
  const sanitizedFrom = sanitizeLanguageCode(from);
  const sanitizedTo = sanitizeLanguageCode(to);

  if (sanitizedFrom === sanitizedTo) {
    throw new ValidationError("Source and target languages must be different", "languagePair");
  }
}

// ============================================================================
// Provider Configuration Validation
// ============================================================================

/**
 * Allowed translation provider endpoints
 * Only HTTPS endpoints from approved providers
 */
const ALLOWED_ENDPOINTS = new Set([
  // Mock/local providers
  "http://localhost",
  "http://127.0.0.1",

  // Real providers (examples - adjust based on actual integrations)
  "https://api.openai.com/v1/chat/completions",
  "https://translation.googleapis.com/language/translate/v2",
  "https://api.deepl.com/v2/translate",
  "https://api.cognitive.microsofttranslator.com/translate",
]);

export interface ProviderConfig {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly timeout: number;
  readonly maxRetries?: number;
}

/**
 * Validates provider configuration
 *
 * - Endpoint must be in allowlist (prevents data exfiltration)
 * - API key must be present (format validation only)
 * - Timeout must be reasonable (1-60 seconds)
 *
 * @param config - Untrusted provider configuration
 * @returns Validated configuration
 * @throws {ValidationError} If configuration is invalid
 * @throws {SecurityError} If endpoint is not in allowlist
 */
export function validateProviderConfig(config: unknown): ProviderConfig {
  if (typeof config !== "object" || config === null) {
    throw new ValidationError("Provider config must be an object", "config");
  }

  // Prevent prototype pollution
  const safe = Object.create(null);
  const raw = config as Record<string, unknown>;

  // Validate endpoint
  if (typeof raw.endpoint !== "string") {
    throw new ValidationError("Endpoint must be a string", "endpoint");
  }

  let url: URL;
  try {
    url = new URL(raw.endpoint);
  } catch {
    throw new ValidationError(`Invalid endpoint URL: ${raw.endpoint}`, "endpoint");
  }

  // Check protocol (allow http for localhost, require https otherwise)
  if (url.protocol !== "https:" && !url.hostname.match(/^(localhost|127\.0\.0\.1)$/)) {
    throw new SecurityError("Endpoint must use HTTPS", "insecure_endpoint");
  }

  // Check against allowlist
  const normalizedEndpoint = `${url.origin}${url.pathname}`.replace(/\/$/, "");
  const isAllowed = Array.from(ALLOWED_ENDPOINTS).some((allowed) =>
    normalizedEndpoint.startsWith(allowed),
  );

  if (!isAllowed) {
    throw new SecurityError(`Endpoint not in allowlist: ${raw.endpoint}`, "endpoint_not_allowed");
  }

  safe.endpoint = url.toString();

  // Validate API key (basic format check only)
  if (typeof raw.apiKey !== "string" || raw.apiKey.length < 10) {
    throw new ValidationError("API key must be a string with at least 10 characters", "apiKey");
  }
  safe.apiKey = raw.apiKey;

  // Validate timeout (1-60 seconds)
  if (typeof raw.timeout !== "number" || raw.timeout < 1000 || raw.timeout > 60000) {
    throw new ValidationError("Timeout must be between 1000-60000ms", "timeout");
  }
  safe.timeout = raw.timeout;

  // Validate optional maxRetries
  if (raw.maxRetries !== undefined) {
    if (typeof raw.maxRetries !== "number" || raw.maxRetries < 0 || raw.maxRetries > 5) {
      throw new ValidationError("maxRetries must be between 0-5", "maxRetries");
    }
    safe.maxRetries = raw.maxRetries;
  }

  return safe as ProviderConfig;
}

// ============================================================================
// Guard Functions
// ============================================================================

/**
 * Guards against ReDoS (Regular Expression Denial of Service)
 *
 * Checks if a text is suspiciously repetitive, which might trigger
 * catastrophic backtracking in regex engines
 *
 * @param text - Text to check
 * @returns True if text appears safe
 */
export function isRegexSafe(text: string): boolean {
  // Check for excessive repetition of characters
  const repetitionPattern = /(.)\1{50,}/; // 50+ identical consecutive chars
  if (repetitionPattern.test(text)) {
    return false;
  }

  // Check for patterns that often cause backtracking
  const backtrackPatterns = [
    /(a+)+b/, // Nested quantifiers
    /(a*)*b/, // Nested zero-or-more
    /a+a+a+a+b/, // Overlapping repetitions
  ];

  for (const pattern of backtrackPatterns) {
    try {
      // Test with timeout simulation (not real timeout in JS)
      const start = Date.now();
      pattern.test(text.slice(0, 1000)); // Only test first 1KB
      if (Date.now() - start > 100) {
        return false; // Took too long
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Guards against prototype pollution
 *
 * Checks if an object has dangerous keys that could pollute prototypes
 *
 * @param obj - Object to check
 * @returns True if object is safe
 */
export function isPrototypeSafe(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) {
    return true;
  }

  const dangerous = ["__proto__", "constructor", "prototype"];
  const keys = Object.keys(obj);

  for (const key of keys) {
    if (dangerous.includes(key)) {
      return false;
    }

    // Recursively check nested objects
    const value = (obj as Record<string, unknown>)[key];
    if (typeof value === "object" && value !== null) {
      if (!isPrototypeSafe(value)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Guards against clipboard injection attacks
 *
 * Sanitizes text before writing to clipboard to prevent:
 * - Command injection via terminal paste
 * - Hidden commands via ANSI escape sequences
 *
 * @param text - Text to write to clipboard
 * @returns Sanitized text safe for clipboard
 */
export function sanitizeForClipboard(text: string): string {
  // Remove ANSI escape sequences
  // eslint-disable-next-line no-control-regex
  const withoutAnsi = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");

  // Remove other control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  const withoutControlChars = withoutAnsi.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  return withoutControlChars;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard for checking if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Type guard for checking if a value is a valid number within range
 */
export function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && !isNaN(value) && value >= min && value <= max;
}

/**
 * Safely parses JSON with size limit
 *
 * @param json - JSON string to parse
 * @param maxSize - Maximum size in bytes (default 1MB)
 * @returns Parsed object
 * @throws {ValidationError} If JSON is invalid or too large
 */
export function safeJsonParse<T = unknown>(json: string, maxSize = MAX_INPUT_SIZE): T {
  if (json.length > maxSize) {
    throw new ValidationError(`JSON exceeds maximum size of ${maxSize} bytes`, "json");
  }

  try {
    const parsed = JSON.parse(json);

    // Check for prototype pollution
    if (!isPrototypeSafe(parsed)) {
      throw new SecurityError("JSON contains prototype pollution attempt", "prototype_pollution");
    }

    return parsed as T;
  } catch (err) {
    if (err instanceof SecurityError) {
      throw err;
    }
    throw new ValidationError(`Invalid JSON: ${(err as Error).message}`, "json");
  }
}
