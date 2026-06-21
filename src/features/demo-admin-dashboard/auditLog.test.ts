import { describe, it, expect } from "vitest";
import { createAuditEntry, formatAuditEntry, AuditLogEntry } from "./auditLog";

describe("Campaign Audit Log", () => {
  const baseEntry: Omit<AuditLogEntry, "id" | "action" | "details"> = {
    timestamp: "2023-10-27T10:00:00.000Z",
    actor: { id: "user-1", name: "Admin User" },
    target: { type: "Campaign", id: "camp-123", name: "Welcome Campaign" },
  };

  it('should format a "create" action correctly', () => {
    const entry = createAuditEntry({ ...baseEntry, action: "create" });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe('Admin User created the campaign "Welcome Campaign".');
  });

  it('should format a generic "update" action correctly', () => {
    const entry = createAuditEntry({ ...baseEntry, action: "update" });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe('Admin User updated the campaign "Welcome Campaign".');
  });

  it('should format a specific "update" action with details', () => {
    const entry = createAuditEntry({
      ...baseEntry,
      action: "update",
      details: { field: "status", from: "draft", to: "ready-for-review" },
    });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe(
      'Admin User updated the status of campaign "Welcome Campaign" from "draft" to "ready-for-review".',
    );
  });

  it('should format an "assign" action with details', () => {
    const entry = createAuditEntry({
      ...baseEntry,
      action: "assign",
      details: { assignee: "Alice" },
    });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe('Admin User assigned the campaign "Welcome Campaign" to Alice.');
  });

  it('should format a "publish" action correctly', () => {
    const entry = createAuditEntry({ ...baseEntry, action: "publish" });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe('Admin User published the campaign "Welcome Campaign".');
  });

  it('should format a "rollback" action with details', () => {
    const entry = createAuditEntry({
      ...baseEntry,
      action: "rollback",
      details: { version: "1.2.0" },
    });
    const formatted = formatAuditEntry(entry);
    expect(formatted).toBe(
      'Admin User rolled back the campaign "Welcome Campaign" to version 1.2.0.',
    );
  });

  it("should create an entry with a valid structure", () => {
    const entry = createAuditEntry({ ...baseEntry, action: "create" });
    expect(entry.id).toMatch(/^audit-\d+/);
    expect(entry.timestamp).toBe(baseEntry.timestamp);
    expect(entry.actor.name).toBe("Admin User");
  });
});
