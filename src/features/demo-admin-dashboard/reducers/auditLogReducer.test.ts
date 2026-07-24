import { describe, it, expect } from "vitest";
import {
  auditLogReducer,
  initialAuditLogState,
  selectRecentAuditEntries,
  type AuditLogState,
} from "./auditLogReducer";
import type { AuditLogEntry } from "../auditLog";

const baseEntryInput: Omit<AuditLogEntry, "id"> = {
  timestamp: "2026-01-01T10:00:00.000Z",
  actor: { id: "user-1", name: "Admin User" },
  action: "create",
  target: { type: "Campaign", id: "camp-1", name: "Welcome Campaign" },
};

describe("auditLogReducer", () => {
  it("starts with no entries", () => {
    expect(initialAuditLogState.entries).toEqual([]);
  });

  it("records a new entry with a generated id at the front", () => {
    const state = auditLogReducer(initialAuditLogState, {
      type: "record",
      payload: baseEntryInput,
    });
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].id).toMatch(/^audit-\d+/);
    expect(state.entries[0].action).toBe("create");
  });

  it("adds a prebuilt entry to the front (newest first)", () => {
    const existing: AuditLogEntry = { id: "audit-1", ...baseEntryInput };
    const newer: AuditLogEntry = { id: "audit-2", ...baseEntryInput, action: "publish" };
    const state = auditLogReducer({ entries: [existing] }, { type: "add", payload: newer });
    expect(state.entries.map((entry) => entry.id)).toEqual(["audit-2", "audit-1"]);
  });

  it("clears all entries", () => {
    const populated: AuditLogState = { entries: [{ id: "audit-1", ...baseEntryInput }] };
    expect(auditLogReducer(populated, { type: "clear" }).entries).toEqual([]);
  });

  it("resets entries to a provided list", () => {
    const entries: AuditLogEntry[] = [
      { id: "audit-1", ...baseEntryInput },
      { id: "audit-2", ...baseEntryInput, action: "publish" },
    ];
    const state = auditLogReducer(initialAuditLogState, { type: "reset", payload: entries });
    expect(state.entries).toHaveLength(2);
  });

  it("selects only the most recent entries up to the limit", () => {
    const entries: AuditLogEntry[] = [
      { id: "audit-3", ...baseEntryInput },
      { id: "audit-2", ...baseEntryInput },
      { id: "audit-1", ...baseEntryInput },
    ];
    const state: AuditLogState = { entries };
    expect(selectRecentAuditEntries(state, 2).map((entry) => entry.id)).toEqual([
      "audit-3",
      "audit-2",
    ]);
    expect(selectRecentAuditEntries(state, 0)).toEqual([]);
  });
});
