/**
 * BETA-091: Redaction helpers for verification-delivery observability.
 * Never emit plaintext tokens, passwords, seeds, or full verification URLs.
 */

const TOKEN_QUERY = /([?&](?:token|code|key)=)[^&\s"'<>]+/gi;
const BEARER = /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const SEED = /\bS[A-Z2-7]{55}\b/g;
const HEX_SECRET = /(?:password|passwd|secret|smtp[_-]?pass(?:word)?)["':=\s]+[^\s"',}]+/gi;
const VERIFY_PATH = /\/verify\?[^\s"'<>]+/gi;
const RESET_PATH = /\/(?:reset-password|password-reset)\?[^\s"'<>]+/gi;

/** Returns the DNS domain of an email, or "unknown" when malformed. */
export function recipientDomain(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return "unknown";
  return email.slice(at + 1).toLowerCase();
}

/** Scrubs secrets and verification URLs from free-form log/error text. */
export function redactNotificationText(input: unknown): string {
  let message =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : (() => {
            try {
              return JSON.stringify(input);
            } catch {
              return String(input);
            }
          })();

  message = message.replace(TOKEN_QUERY, "$1[REDACTED_TOKEN]");
  message = message.replace(VERIFY_PATH, "/verify?[REDACTED]");
  message = message.replace(RESET_PATH, "/reset-password?[REDACTED]");
  message = message.replace(BEARER, "Bearer [REDACTED_TOKEN]");
  message = message.replace(SEED, "[REDACTED_SEED]");
  message = message.replace(HEX_SECRET, "[REDACTED_SECRET]");
  return message.slice(0, 400);
}

/** True when text still appears to contain a raw verification token or secret. */
export function containsSensitiveNotificationMaterial(text: string): boolean {
  if (/[?&](?:token|code)=[A-Za-z0-9_-]{16,}/i.test(text)) return true;
  if (/\/verify\?[^#\s]*token=/i.test(text)) return true;
  if (/\bS[A-Z2-7]{55}\b/.test(text)) return true;
  if (/Bearer\s+[A-Za-z0-9._~+/-]{20,}/i.test(text)) return true;
  return false;
}
