import { describe, expect, it } from "vitest";

import { MOCK_AUDIT_EVENTS } from "@/features/audit-log/data";
import {
  filterAuditEvents,
  formatEventAsText,
  hasActiveAuditFilter,
} from "@/features/audit-log/useAuditLog";
import type { AuditFilter } from "@/features/audit-log/types";

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
});

describe("hasActiveAuditFilter", () => {
  it("treats the default filter as inactive", () => {
    expect(hasActiveAuditFilter({ category: "all", search: "" })).toBe(false);
  });

  it("detects active category and search filters", () => {
    expect(hasActiveAuditFilter({ category: "policy", search: "" })).toBe(true);
    expect(hasActiveAuditFilter({ category: "all", search: "session" })).toBe(true);
  });
});

describe("formatEventAsText", () => {
  it("formats a readable diagnostics line without message body content", () => {
    const event = MOCK_AUDIT_EVENTS[0];
    const line = formatEventAsText(event);

    expect(line).toContain(event.ts);
    expect(line).toContain(event.kind);
    expect(line).toContain(event.summary);
    expect(line).not.toMatch(/body=/i);
  });
});
