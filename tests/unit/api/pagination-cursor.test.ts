import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError } from "../../../src/server/api/errors";
import { decodeCursor, encodeCursor } from "../../../src/server/api/pagination";

// Issue #1490: signed opaque pagination cursor.
const SECRET = "test-cursor-secret";

describe("signed opaque pagination cursor", () => {
  beforeEach(() => {
    process.env.STEALTH_CURSOR_SECRET = SECRET;
  });

  afterEach(() => {
    delete process.env.STEALTH_CURSOR_SECRET;
  });

  it("round-trips a continuation key for the same actor and scope", () => {
    const cursor = encodeCursor("owner-A", "msg-0000100", "inbox");
    const decoded = decodeCursor(cursor, "owner-A", "inbox");
    expect(decoded.continuationKey).toBe("msg-0000100");
  });

  it("rejects a tampered cursor", () => {
    const cursor = encodeCursor("owner-A", "msg-0000100", "inbox");
    const tampered = `${cursor.slice(0, -2)}zz`;
    expect(() => decodeCursor(tampered, "owner-A", "inbox")).toThrow(/Tampered pagination cursor/);
  });

  it("rejects cross-actor reuse", () => {
    const cursor = encodeCursor("owner-A", "msg-0000100", "inbox");
    expect(() => decodeCursor(cursor, "owner-B", "inbox")).toThrow(/different actor/);
  });

  it("rejects a cursor whose scope (filter) changed", () => {
    const cursor = encodeCursor("owner-A", "msg-0000100", "inbox");
    expect(() => decodeCursor(cursor, "owner-A", "archive")).toThrow(ApiError);
  });

  it("rejects malformed structure", () => {
    expect(() => decodeCursor("not-a-cursor", "owner-A", "inbox")).toThrow(ApiError);
  });
});
