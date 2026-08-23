/**
 * Durable mailbox sync cursors (Issue #1941 BETA-034).
 *
 * Cursors are versioned, HMAC-signed, and bound to the mailbox owner plus a
 * device id. They carry an explicit expiry so a stale reconnect recovers
 * through a bounded full resync rather than replaying unbounded history.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { ApiError } from "@/server/api/errors";

import { SYNC_CURSOR_TTL_MS } from "./mailbox-sync-types";

const CURSOR_VERSION = 1;

interface MailboxCursorPayload {
  v: number;
  actor: string;
  deviceId: string;
  seq: number;
  iat: number;
  exp: number;
}

function cursorSecret(): string {
  return process.env.STEALTH_CURSOR_SECRET ?? "";
}

function sign(payload: string): string {
  const secret = cursorSecret();
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

export interface EncodedMailboxCursor {
  actor: string;
  deviceId: string;
  seq: number;
  issuedAt: number;
  expiresAt: number;
}

export function encodeMailboxCursor(
  actor: string,
  deviceId: string,
  seq: number,
  nowMs: number = Date.now(),
  ttlMs: number = SYNC_CURSOR_TTL_MS,
): string {
  if (!Number.isSafeInteger(seq) || seq < 0) {
    throw new ApiError(500, "internal_error", "Mailbox cursor seq is invalid");
  }
  const payload: MailboxCursorPayload = {
    v: CURSOR_VERSION,
    actor,
    deviceId,
    seq,
    iat: nowMs,
    exp: nowMs + ttlMs,
  };
  const raw = JSON.stringify(payload);
  return `${CURSOR_VERSION}.${sign(raw)}.${base64UrlEncode(raw)}`;
}

export function decodeMailboxCursor(
  cursor: string,
  actor: string,
  deviceId: string,
  nowMs: number = Date.now(),
): EncodedMailboxCursor {
  if (!cursorSecret()) {
    throw new ApiError(500, "internal_error", "Cursor signing secret is not configured");
  }

  const parts = cursor.split(".");
  if (parts.length !== 3) {
    throw new ApiError(400, "bad_request", "Invalid mailbox sync cursor");
  }
  const [versionStr, signature, encoded] = parts;
  const version = Number(versionStr);
  if (!Number.isInteger(version) || version !== CURSOR_VERSION) {
    throw new ApiError(400, "bad_request", "Unsupported mailbox sync cursor version");
  }

  let raw: string;
  try {
    raw = base64UrlDecode(encoded);
  } catch {
    throw new ApiError(400, "bad_request", "Invalid mailbox sync cursor");
  }

  const expected = sign(raw);
  const provided = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    throw new ApiError(400, "bad_request", "Tampered mailbox sync cursor rejected");
  }

  let payload: MailboxCursorPayload;
  try {
    payload = JSON.parse(raw) as MailboxCursorPayload;
  } catch {
    throw new ApiError(400, "bad_request", "Invalid mailbox sync cursor");
  }

  if (payload.v !== CURSOR_VERSION || !Number.isSafeInteger(payload.seq) || payload.seq < 0) {
    throw new ApiError(400, "bad_request", "Invalid mailbox sync cursor");
  }
  if (payload.actor !== actor) {
    throw new ApiError(403, "forbidden", "Mailbox sync cursor is bound to a different actor");
  }
  if (payload.deviceId !== deviceId) {
    throw new ApiError(400, "bad_request", "Mailbox sync cursor is bound to a different device");
  }
  if (payload.exp <= nowMs) {
    throw new ApiError(410, "cursor_expired", "Mailbox sync cursor has expired");
  }

  return {
    actor: payload.actor,
    deviceId: payload.deviceId,
    seq: payload.seq,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}
