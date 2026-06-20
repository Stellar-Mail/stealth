import { describe, expect, it } from "vitest";
import { filterEvents, formatEventAsText } from "@/features/audit-log/useAuditLog";
import type { AuditEvent } from "@/features/audit-log/types";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EVENTS: AuditEvent[] = [
  {
    id: "t_001",
    kind: "session.started",
    category: "security",
    ts: "2026-01-01T10:00:00.000Z",
    actor: { type: "user", address: "GDQ4...X4KJ", displayName: "Alice" },
    summary: "Session started",
  },
  {
    id: "t_002",
    kind: "delivery.message_received",
    category: "delivery",
    ts: "2026-01-01T10:01:00.000Z",
    actor: { type: "relay", relayId: "relay-eu-west-1" },
    summary: "Message received from bob@example.com",
    context: { messageId: "msg_abc1", senderDisplayName: "Bob" },
  },
  {
    id: "t_003",
    kind: "postage.settled",
    category: "billing",
    ts: "2026-01-01T10:02:00.000Z",
    actor: { type: "system" },
    summary: "Postage settled for msg_abc1",
    context: { messageId: "msg_abc1", amount: "0.0001", currency: "XLM" },
  },
  {
    id: "t_004",
    kind: "identity.verification_failed",
    category: "security",
    ts: "2026-01-01T10:03:00.000Z",
    actor: { type: "system" },
    summary: "Identity verification failed for unknown sender",
    context: { senderAddress: "GCXX...7LAB" },
  },
];

// ─── filterEvents ─────────────────────────────────────────────────────────────

describe("filterEvents", () => {
  it("returns all events when category is 'all' and search is empty", () => {
    const result = filterEvents(EVENTS, { category: "all", search: "" });
    expect(result.map((e) => e.id)).toEqual(["t_001", "t_002", "t_003", "t_004"]);
  });

  it("narrows to the correct category", () => {
    expect(filterEvents(EVENTS, { category: "security", search: "" }).map((e) => e.id)).toEqual([
      "t_001",
      "t_004",
    ]);
    expect(filterEvents(EVENTS, { category: "delivery", search: "" }).map((e) => e.id)).toEqual([
      "t_002",
    ]);
    expect(filterEvents(EVENTS, { category: "billing", search: "" }).map((e) => e.id)).toEqual([
      "t_003",
    ]);
  });

  it("matches search against summary, kind, senderDisplayName, and messageId", () => {
    expect(filterEvents(EVENTS, { category: "all", search: "bob" }).map((e) => e.id)).toEqual([
      "t_002",
    ]);
    expect(filterEvents(EVENTS, { category: "all", search: "msg_abc1" }).map((e) => e.id)).toEqual([
      "t_002",
      "t_003",
    ]);
    expect(
      filterEvents(EVENTS, { category: "all", search: "session.started" }).map((e) => e.id),
    ).toEqual(["t_001"]);
  });

  it("search is case-insensitive", () => {
    expect(filterEvents(EVENTS, { category: "all", search: "SESSION" })).toHaveLength(1);
    expect(filterEvents(EVENTS, { category: "all", search: "BOB" })).toHaveLength(1);
  });

  // edge: no match
  it("returns empty array when search matches nothing", () => {
    expect(filterEvents(EVENTS, { category: "all", search: "zzznotfound" })).toHaveLength(0);
  });

  // edge: category with zero events in fixture
  it("returns empty array when no events belong to the selected category", () => {
    expect(filterEvents(EVENTS, { category: "policy", search: "" })).toHaveLength(0);
  });

  it("applies category and search together", () => {
    expect(
      filterEvents(EVENTS, { category: "security", search: "failed" }).map((e) => e.id),
    ).toEqual(["t_004"]);
  });
});

// ─── formatEventAsText ────────────────────────────────────────────────────────

describe("formatEventAsText", () => {
  it("includes timestamp, kind, actor label, and summary", () => {
    const line = formatEventAsText(EVENTS[0]);
    expect(line).toContain("[2026-01-01T10:00:00.000Z]");
    expect(line).toContain("session.started");
    expect(line).toContain("Alice");
    expect(line).toContain("Session started");
  });

  it("uses address as actor label when user has no displayName", () => {
    const event: AuditEvent = { ...EVENTS[0], actor: { type: "user", address: "GDQ4...X4KJ" } };
    expect(formatEventAsText(event)).toContain("GDQ4...X4KJ");
  });

  it("uses relayId as actor label for relay actor", () => {
    expect(formatEventAsText(EVENTS[1])).toContain("relay-eu-west-1");
  });

  it("includes context key=value pairs when context is present", () => {
    const line = formatEventAsText(EVENTS[2]);
    expect(line).toContain("messageId=msg_abc1");
    expect(line).toContain("amount=0.0001");
    expect(line).toContain("currency=XLM");
  });

  // edge: no context
  it("omits the context segment when context is absent", () => {
    const line = formatEventAsText(EVENTS[0]);
    // Should end after the summary with no trailing pipe
    expect(line.endsWith("Session started")).toBe(true);
  });

  // safety: no message body content in any formatted fixture line
  it("does not leak body-like content through any fixture", () => {
    for (const event of EVENTS) {
      expect(formatEventAsText(event)).not.toMatch(/body|content|payload|subject/i);
    }
  });
});
