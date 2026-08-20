import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import {
  decodeMailboxCursor,
  encodeMailboxCursor,
} from "../../../src/services/relay/mailbox-cursor";
import { SYNC_CURSOR_TTL_MS } from "../../../src/services/relay/mailbox-sync-types";

const SECRET = "test-mailbox-cursor-secret";
const actor = `G${"A".repeat(55)}`;
const deviceId = "device-one";

describe("durable mailbox sync cursor", () => {
  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.STEALTH_CURSOR_SECRET;
  });

  it("round-trips actor, device, and seq", () => {
    const cursor = encodeMailboxCursor(actor, deviceId, 12, 1_000);
    const decoded = decodeMailboxCursor(cursor, actor, deviceId, 1_001);
    expect(decoded).toMatchObject({ actor, deviceId, seq: 12 });
    expect(decoded.expiresAt).toBe(1_000 + SYNC_CURSOR_TTL_MS);
  });

  it("rejects a tampered cursor", () => {
    const cursor = encodeMailboxCursor(actor, deviceId, 1, 1_000);
    expect(() => decodeMailboxCursor(`${cursor.slice(0, -2)}zz`, actor, deviceId, 1_001)).toThrow(
      /Tampered mailbox sync cursor/,
    );
  });

  it("rejects cross-actor reuse", () => {
    const cursor = encodeMailboxCursor(actor, deviceId, 1, 1_000);
    expect(() => decodeMailboxCursor(cursor, `G${"B".repeat(55)}`, deviceId, 1_001)).toThrow(
      ApiError,
    );
  });

  it("rejects a cursor bound to a different device", () => {
    const cursor = encodeMailboxCursor(actor, deviceId, 1, 1_000);
    expect(() => decodeMailboxCursor(cursor, actor, "device-two", 1_001)).toThrow(
      /different device/,
    );
  });

  it("expires after the configured TTL", () => {
    const issuedAt = 1_000;
    const cursor = encodeMailboxCursor(actor, deviceId, 4, issuedAt, 50);
    expect(() => decodeMailboxCursor(cursor, actor, deviceId, issuedAt + 50)).toThrow(ApiError);
    try {
      decodeMailboxCursor(cursor, actor, deviceId, issuedAt + 50);
    } catch (error) {
      expect(error).toMatchObject({ code: "cursor_expired", status: 410 });
    }
  });
});
