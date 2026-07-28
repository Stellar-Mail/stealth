import { createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "./errors";

/**
 * Issue #1544: a versioned, signed opaque postage-quote token.
 *
 * A quote token binds the exact terms a client was priced at — sender,
 * recipient, message id, amount, and the mailbox policy version in effect
 * at quote time — so a client cannot reuse a quote for a different message,
 * inflate/deflate the amount, or replay a stale quote after the recipient's
 * policy has changed. It is protected by an HMAC signature derived from a
 * server-side secret and carries an explicit version, following the same
 * shape as the pagination cursor in `pagination.ts`.
 */

const QUOTE_VERSION = 1;
const SECRET = () => {
  const secret = process.env.STEALTH_POSTAGE_QUOTE_SECRET ?? "";
  return secret;
};

export interface PostageQuoteBinding {
  sender: string;
  recipient: string;
  messageId: string;
  amount: string;
  policyVersion: number;
}

interface QuotePayload extends PostageQuoteBinding {
  v: number;
}

function sign(payload: string): string {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Postage quote signing secret is not configured");
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
 * Encode a postage quote into a signed, opaque token bound to the sender,
 * recipient, message id, amount, and policy version.
 */
export function signPostageQuote(binding: PostageQuoteBinding): string {
  const payload: QuotePayload = {
    v: QUOTE_VERSION,
    ...binding,
  };
  const raw = JSON.stringify(payload);
  const encoded = base64UrlEncode(raw);
  const signature = sign(raw);
  // format: version.signature.encoded
  return `${QUOTE_VERSION}.${signature}.${encoded}`;
}

/**
 * Decode and verify a postage quote token. Throws on missing secret,
 * malformed structure, unsupported version, signature failure, or a
 * mismatch against the expected binding (any field substitution is
 * rejected).
 */
export function verifyPostageQuote(token: string, expected: PostageQuoteBinding): void {
  const secret = SECRET();
  if (!secret) {
    throw new ApiError(500, "internal_error", "Postage quote signing secret is not configured");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new ApiError(400, "bad_request", "Invalid postage quote token");
  }
  const [versionStr, signature, encoded] = parts;
  const version = Number(versionStr);
  if (!Number.isInteger(version) || version !== QUOTE_VERSION) {
    throw new ApiError(400, "bad_request", "Unsupported postage quote token version");
  }

  const raw = base64UrlDecode(encoded);
  const expectedSignature = sign(raw);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    throw new ApiError(400, "bad_request", "Tampered postage quote token rejected");
  }

  let payload: QuotePayload;
  try {
    payload = JSON.parse(raw) as QuotePayload;
  } catch {
    throw new ApiError(400, "bad_request", "Invalid postage quote token");
  }

  if (
    payload.sender !== expected.sender ||
    payload.recipient !== expected.recipient ||
    payload.messageId !== expected.messageId ||
    payload.amount !== expected.amount ||
    payload.policyVersion !== expected.policyVersion
  ) {
    throw new ApiError(
      409,
      "conflict",
      "Postage quote does not match the submitted terms or has expired",
    );
  }
}
