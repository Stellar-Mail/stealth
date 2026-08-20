import { z } from "zod";

export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 32;
export const DEFAULT_STEALTH_DOMAIN = "stealth.me";

/**
 * System and protocol reserved usernames that cannot be registered by standard users.
 */
export const RESERVED_USERNAMES = new Set([
  "about",
  "abuse",
  "account",
  "accounts",
  "admin",
  "administrator",
  "all",
  "analytics",
  "api",
  "app",
  "apps",
  "archive",
  "auth",
  "authentication",
  "backup",
  "billing",
  "blog",
  "bot",
  "broadcast",
  "bugs",
  "build",
  "call",
  "cli",
  "cluster",
  "compliance",
  "config",
  "contact",
  "contacts",
  "cron",
  "dashboard",
  "data",
  "db",
  "demo",
  "deploy",
  "dev",
  "developer",
  "developers",
  "direct",
  "dns",
  "docs",
  "documentation",
  "domain",
  "drafts",
  "email",
  "errors",
  "escrow",
  "event",
  "events",
  "explore",
  "faq",
  "federation",
  "feed",
  "feedback",
  "file",
  "files",
  "forum",
  "ftp",
  "gateway",
  "git",
  "group",
  "groups",
  "guest",
  "guide",
  "head",
  "health",
  "help",
  "home",
  "host",
  "hostmaster",
  "http",
  "https",
  "icon",
  "icons",
  "identity",
  "imap",
  "inbox",
  "info",
  "internal",
  "invite",
  "invites",
  "key",
  "keys",
  "legal",
  "login",
  "logout",
  "logs",
  "mail",
  "mailbox",
  "master",
  "media",
  "metrics",
  "monitor",
  "mx",
  "news",
  "null",
  "official",
  "offline",
  "online",
  "org",
  "outbox",
  "owner",
  "password",
  "patch",
  "payment",
  "payments",
  "ping",
  "pop",
  "pop3",
  "postage",
  "postmaster",
  "privacy",
  "proof",
  "proxy",
  "pub",
  "public",
  "publish",
  "query",
  "raw",
  "read",
  "readiness",
  "receipts",
  "recovery",
  "register",
  "registration",
  "relay",
  "repl",
  "reports",
  "requests",
  "reset",
  "resolver",
  "root",
  "router",
  "rss",
  "sales",
  "search",
  "secret",
  "secrets",
  "security",
  "send",
  "sender",
  "server",
  "service",
  "services",
  "session",
  "sessions",
  "setting",
  "settings",
  "share",
  "shell",
  "shop",
  "signin",
  "signout",
  "signup",
  "site",
  "smtp",
  "soroban",
  "spec",
  "specs",
  "ssl",
  "stage",
  "staging",
  "state",
  "status",
  "stellar",
  "stealth",
  "stealthmail",
  "steward",
  "store",
  "sudo",
  "support",
  "sys",
  "sysadmin",
  "system",
  "tag",
  "team",
  "terms",
  "test",
  "testing",
  "tests",
  "token",
  "tokens",
  "tools",
  "trash",
  "trust",
  "turn",
  "types",
  "undefined",
  "user",
  "users",
  "v1",
  "v2",
  "validate",
  "validation",
  "vault",
  "verify",
  "verification",
  "version",
  "video",
  "void",
  "wallet",
  "wallets",
  "web",
  "webmaster",
  "webhook",
  "wiki",
  "ws",
  "wss",
  "www",
  "zero",
]);

/** Zero-width and invisible control characters. */
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00AD\u200E\u200F]/g;

/**
 * Applies Unicode NFKC normalization, strips zero-width characters, trims
 * leading/trailing whitespace, and converts to lower case.
 */
export function normalizeUsername(input: string): string {
  if (!input) return "";
  return input.normalize("NFKC").replace(ZERO_WIDTH_REGEX, "").trim().toLowerCase();
}

/**
 * Detects whether the input username contains confusable, homoglyph, or non-ASCII characters.
 */
export function hasConfusableCharacters(input: string): boolean {
  if (!input) return false;
  // If NFKC normalization modifies characters or contains zero-width characters
  const normalized = input.normalize("NFKC");
  if (ZERO_WIDTH_REGEX.test(input)) return true;
  // Non-ASCII characters (Cyrillic, Greek, fullwidth, accents, math symbols, etc.)
  if (/[^\x00-\x7F]/.test(input) || /[^\x00-\x7F]/.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * Checks whether the normalized username is reserved by the system.
 */
export function isReservedUsername(username: string): boolean {
  const norm = normalizeUsername(username);
  return RESERVED_USERNAMES.has(norm);
}

export type UsernameValidationReason =
  "length" | "pattern" | "consecutive_symbols" | "confusable_characters" | "reserved_word";

export interface UsernameValidationResult {
  valid: boolean;
  normalized: string;
  reason?: UsernameValidationReason;
  message?: string;
  canonicalEmail?: string;
  federationHandle?: string;
}

/**
 * Formats a canonical Stealth email identity: username@domain (default: stealth.me).
 */
export function toStealthEmail(username: string, domain = DEFAULT_STEALTH_DOMAIN): string {
  const norm = normalizeUsername(username);
  return `${norm}@${domain}`;
}

/**
 * Formats a Stellar federation handle: username*domain (default: stealth.me).
 */
export function toStellarFederation(username: string, domain = DEFAULT_STEALTH_DOMAIN): string {
  const norm = normalizeUsername(username);
  return `${norm}*${domain}`;
}

/**
 * Validates a username against length, character set, homoglyph/confusable,
 * symbol positioning, and reserved-word rules.
 */
export function validateUsername(
  input: string,
  domain = DEFAULT_STEALTH_DOMAIN,
): UsernameValidationResult {
  if (!input || typeof input !== "string") {
    return {
      valid: false,
      normalized: "",
      reason: "length",
      message: "Username is required",
    };
  }

  // Check for homoglyphs or non-ASCII confusables before stripping
  if (hasConfusableCharacters(input)) {
    return {
      valid: false,
      normalized: normalizeUsername(input),
      reason: "confusable_characters",
      message: "Username contains invalid or confusable Unicode characters",
    };
  }

  const normalized = normalizeUsername(input);

  if (normalized.length < MIN_USERNAME_LENGTH || normalized.length > MAX_USERNAME_LENGTH) {
    return {
      valid: false,
      normalized,
      reason: "length",
      message: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`,
    };
  }

  // Must begin and end with an alphanumeric character
  if (!/^[a-z0-9].*[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "pattern",
      message: "Username must start and end with a letter or number",
    };
  }

  // Allowed character set: lowercase alphanumeric, hyphens, underscores
  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "pattern",
      message: "Username can only contain lowercase letters, numbers, underscores, or hyphens",
    };
  }

  // No consecutive hyphens or underscores
  if (/[-_]{2,}/.test(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "consecutive_symbols",
      message: "Username cannot contain consecutive hyphens or underscores",
    };
  }

  // Check system reserved words
  if (RESERVED_USERNAMES.has(normalized)) {
    return {
      valid: false,
      normalized,
      reason: "reserved_word",
      message: "This username is reserved by the system",
    };
  }

  return {
    valid: true,
    normalized,
    canonicalEmail: toStealthEmail(normalized, domain),
    federationHandle: toStellarFederation(normalized, domain),
  };
}

/**
 * Zod schema enforcing canonical username rules.
 */
export const canonicalUsernameSchema = z
  .string()
  .trim()
  .transform((val) => normalizeUsername(val))
  .superRefine((val, ctx) => {
    const res = validateUsername(val);
    if (!res.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: res.message ?? "Invalid username",
      });
    }
  });
