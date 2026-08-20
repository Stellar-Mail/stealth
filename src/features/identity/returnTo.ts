// ---------------------------------------------------------------------------
// BETA-012 — return-to (post-login redirect) validation.
//
// The `next` search parameter carried through the sign-in flow is attacker
// controllable. Only same-origin relative paths may be honored: absolute
// URLs, protocol-relative URLs, backslash-aliased authorities and control
// characters are rejected so a crafted value can never bounce the browser
// off this origin.
// ---------------------------------------------------------------------------

/** C0 control characters (including CR/LF/TAB) can smuggle headers or URLs. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** Bytes that alias a protocol-relative or authority-prefixed URL. */
const FORBIDDEN_PREFIX = /^(\/\/|\/\\)/;

/** Any backslash anywhere is rejected: browsers may alias it to a separator. */
const FORBIDDEN_BACKSLASH = /\\/;

/**
 * Validates an untrusted return-to value.
 *
 * Returns the sanitized same-origin relative path (with a leading `/`),
 * or `null` when the value is missing or unsafe.
 */
export function validateReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.startsWith("/")) return null;
  if (FORBIDDEN_PREFIX.test(trimmed)) return null;
  if (FORBIDDEN_BACKSLASH.test(trimmed)) return null;
  if (hasControlChars(trimmed)) return null;
  try {
    if (decodeURIComponent(trimmed).startsWith("//")) return null;
  } catch {
    return null;
  }
  return trimmed;
}

/**
 * Convenience wrapper: unsafe or missing values fall back to the home path.
 * Intended for call sites that must always produce a destination.
 */
export function safeReturnTo(value: unknown): string {
  return validateReturnTo(value) ?? "/";
}
