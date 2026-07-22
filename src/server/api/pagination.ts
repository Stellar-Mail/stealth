import { createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "./errors";

/**
 * Issue #1490: a versioned, signed opaque pagination cursor.
 *
 * The cursor encodes the full continuation key plus the query scope (actor and
 * any filters) so a client cannot tamper with continuation position, actor
 * scope, filters, or ordering. It is protected by an HMAC signature derived
 * from a server-side secret and carries an explicit version.
 */

const CURSOR_VERSION = 1;
const SECRET = () => {
  const secret = process.env.STEALTH_CURSOR_SECRET ?? "";
  return secret;
};

interface CursorPayload {
  v: number;
  key: string;
  actor: string;
  scope: string;
}

function sign(payload: string): string {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Cursor signing secret is not configured");
  }
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

/**
 * Encode a continuation position into a signed, opaque cursor bound to the
 * actor and query scope.
 */
export function encodeCursor(actor: string, continuationKey: string, scope: string): string {
  const payload: CursorPayload = {
    v: CURSOR_VERSION,
    key: continuationKey,
    actor,
    scope,
  };
  const raw = JSON.stringify(payload);
  const encoded = base64UrlEncode(raw);
  const signature = sign(raw);
  // format: version.signature.encoded
  return `${CURSOR_VERSION}.${signature}.${encoded}`;
}

/**
 * Decode and verify a cursor. Throws on missing secret, malformed structure,
 * version mismatch, signature failure, or actor/scope binding mismatch.
 */
export function decodeCursor(
  cursor: string,
  actor: string,
  scope: string,
): { continuationKey: string } {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Cursor signing secret is not configured");
  }

  const parts = cursor.split(".");
  if (parts.length !== 3) {
    throw new ApiError(400, "bad_request", "Invalid pagination cursor");
  }
  const [versionStr, signature, encoded] = parts;
  const version = Number(versionStr);
  if (!Number.isInteger(version) || version !== CURSOR_VERSION) {
    throw new ApiError(400, "bad_request", "Unsupported pagination cursor version");
  }

  const raw = base64UrlDecode(encoded);
  const expected = sign(raw);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    throw new ApiError(400, "bad_request", "Tampered pagination cursor rejected");
  }

  let payload: CursorPayload;
  try {
    payload = JSON.parse(raw) as CursorPayload;
  } catch {
    throw new ApiError(400, "bad_request", "Invalid pagination cursor");
  }

  if (payload.actor !== actor) {
    throw new ApiError(403, "forbidden", "Pagination cursor is bound to a different actor");
  }
  if (payload.scope !== scope) {
    throw new ApiError(400, "bad_request", "Pagination cursor scope does not match this query");
  }

  return { continuationKey: payload.key };
}
