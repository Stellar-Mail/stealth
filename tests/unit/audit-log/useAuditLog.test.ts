import { describe, expect, it } from "vitest";

import { MOCK_AUDIT_EVENTS } from "@/features/audit-log/data";
import {
  filterAuditEvents,
  formatEventAsText,
  hasActiveAuditFilter,
} from "@/features/audit-log/useAuditLog";
import { CATEGORY_FOR_KIND } from "@/features/audit-log/types";
import type { AuditEventKind, AuditFilter } from "@/features/audit-log/types";

// ---------------------------------------------------------------------------
// filterAuditEvents
// ---------------------------------------------------------------------------

describe("filterAuditEvents", () => {
  it("returns all events when no filters are active (success path)", () => {
    const filter: AuditFilter = { category: "all", search: "" };
    expect(filterAuditEvents(MOCK_AUDIT_EVENTS, filter)).toHaveLength(MOCK_AUDIT_EVENTS.length);
  });

  it("narrows results by category", () => {
    const filter: AuditFilter = { category: "billing", search: "" };
    const events = filterAuditEvents(MOCK_AUDIT_EVENTS, filter);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.category === "billing")).toBe(true);
  });

  it("matches search text across summary, kind, sender, and message id", () => {
    const filter: AuditFilter = { category: "all", search: "msg_4f2a" };
    const events = filterAuditEvents(MOCK_AUDIT_EVENTS, filter);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.context?.messageId === "msg_4f2a")).toBe(true);
  });

  it("returns an empty list when nothing matches the active filters (edge case)", () => {
    const filter: AuditFilter = { category: "security", search: "msg_4f2a" };
    expect(filterAuditEvents(MOCK_AUDIT_EVENTS, filter)).toEqual([]);
  });

  it("performs case-insensitive search", () => {
    const filter: AuditFilter = { category: "all", search: "SESSION" };
    const events = filterAuditEvents(MOCK_AUDIT_EVENTS, filter);

    expect(events.every((event) => event.kind.startsWith("session."))).toBe(true);
  });

  it("searches by senderDisplayName in context", () => {
    const filter: AuditFilter = { category: "all", search: "Marcin Kowalski" };
    const events = filterAuditEvents(MOCK_AUDIT_EVENTS, filter);

    expect(events.length).toBeGreaterThan(0);
    expect(
      events.every((event) =>
        event.context?.senderDisplayName?.toLowerCase().includes("marcin kowalski"),
      ),
    ).toBe(true);
  });

  it("intersects category and search filters", () => {
    const filter: AuditFilter = { category: "billing", search: "msg_4f2a" };
    const events = filterAuditEvents(MOCK_AUDIT_EVENTS, filter);

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((event) => event.category === "billing")).toBe(true);
    expect(events.every((event) => event.context?.messageId === "msg_4f2a")).toBe(true);
  });

  it("handles empty events array", () => {
    const filter: AuditFilter = { category: "all", search: "" };
    expect(filterAuditEvents([], filter)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hasActiveAuditFilter
// ---------------------------------------------------------------------------

describe("hasActiveAuditFilter", () => {
  it("treats the default filter as inactive", () => {
    expect(hasActiveAuditFilter({ category: "all", search: "" })).toBe(false);
  });

  it("detects active category and search filters", () => {
    expect(hasActiveAuditFilter({ category: "policy", search: "" })).toBe(true);
    expect(hasActiveAuditFilter({ category: "all", search: "session" })).toBe(true);
  });

  it("treats whitespace-only search as inactive because the input is trimmed", () => {
    expect(hasActiveAuditFilter({ category: "all", search: "   " })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formatEventAsText
// ---------------------------------------------------------------------------

describe("formatEventAsText", () => {
  it("formats a readable diagnostics line without message body content", () => {
    const event = MOCK_AUDIT_EVENTS[0];
    const line = formatEventAsText(event);

    expect(line).toContain(event.ts);
    expect(line).toContain(event.kind);
    expect(line).toContain(event.summary);
    expect(line).not.toMatch(/body=/i);
  });

  it("includes context key-value pairs when context is present", () => {
    const event = MOCK_AUDIT_EVENTS[2];
    const line = formatEventAsText(event);

    expect(line).toContain(event.ts);
    expect(line).toContain(event.kind);
    expect(line).toContain("policyValue=request");
  });

  it("does not include a context segment when context is absent", () => {
    const event = MOCK_AUDIT_EVENTS[0];
    const line = formatEventAsText(event);

    expect(line).not.toMatch(/\| $/);
  });

  it("renders user actor with displayName", () => {
    const event = MOCK_AUDIT_EVENTS[0];
    const line = formatEventAsText(event);

    expect(line).toContain("Demo Operator");
  });

  it("renders system actor", () => {
    const event = MOCK_AUDIT_EVENTS[1];
    const line = formatEventAsText(event);

    expect(line).toContain("system");
  });

  it("renders relay actor with relayId", () => {
    const event = MOCK_AUDIT_EVENTS[4];
    const line = formatEventAsText(event);

    expect(line).toContain("relay-us-east-1");
  });

  it("includes multiple context fields joined by spaces", () => {
    const event = MOCK_AUDIT_EVENTS[4];
    const line = formatEventAsText(event);

    expect(line).toContain("messageId=msg_4f2a");
    expect(line).toContain("senderDisplayName=Marcin Kowalski");
  });
});

// ---------------------------------------------------------------------------
// CATEGORY_FOR_KIND mapping
// ---------------------------------------------------------------------------

describe("CATEGORY_FOR_KIND", () => {
  it("maps every defined AuditEventKind to a category", () => {
    const kinds: AuditEventKind[] = [
      "policy.default_changed",
      "policy.sender_allowed",
      "policy.sender_blocked",
      "policy.sender_verified",
      "delivery.message_received",
      "delivery.receipt_issued",
      "delivery.message_bounced",
      "session.started",
      "session.ended",
      "identity.resolved",
      "identity.verification_failed",
      "postage.attached",
      "postage.settled",
      "postage.refunded",
    ];

    for (const kind of kinds) {
      expect(CATEGORY_FOR_KIND[kind]).toBeDefined();
    }
  });

  it("correctly classifies each kind into the expected category", () => {
    expect(CATEGORY_FOR_KIND["policy.default_changed"]).toBe("policy");
    expect(CATEGORY_FOR_KIND["policy.sender_allowed"]).toBe("policy");
    expect(CATEGORY_FOR_KIND["policy.sender_blocked"]).toBe("policy");
    expect(CATEGORY_FOR_KIND["policy.sender_verified"]).toBe("policy");
    expect(CATEGORY_FOR_KIND["delivery.message_received"]).toBe("delivery");
    expect(CATEGORY_FOR_KIND["delivery.receipt_issued"]).toBe("delivery");
    expect(CATEGORY_FOR_KIND["delivery.message_bounced"]).toBe("delivery");
    expect(CATEGORY_FOR_KIND["session.started"]).toBe("security");
    expect(CATEGORY_FOR_KIND["session.ended"]).toBe("security");
    expect(CATEGORY_FOR_KIND["identity.resolved"]).toBe("security");
    expect(CATEGORY_FOR_KIND["identity.verification_failed"]).toBe("security");
    expect(CATEGORY_FOR_KIND["postage.attached"]).toBe("billing");
    expect(CATEGORY_FOR_KIND["postage.settled"]).toBe("billing");
    expect(CATEGORY_FOR_KIND["postage.refunded"]).toBe("billing");
  });

  it("has exactly 14 entries matching the AuditEventKind union", () => {
    expect(Object.keys(CATEGORY_FOR_KIND)).toHaveLength(14);
  });
});
