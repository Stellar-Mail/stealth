import { describe, it, expect, vi, afterEach } from "vitest";
import { recordAuditEvent, auditEventSchema } from "../../../src/server/api/audit";

describe("audit service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a structured audit event for a successful security-sensitive action", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    recordAuditEvent({
      actor: `G${"A".repeat(55)}`,
      action: "policy.update",
      targetType: "policy",
      safeTargetReference: `mailbox:G${"A".repeat(55)}:policy`,
      result: "success",
      requestId: "req-abc-123",
    });

    expect(console.info).toHaveBeenCalledOnce();
    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);

    expect(logData).toMatchObject({
      _audit: true,
      actor: `G${"A".repeat(55)}`,
      action: "policy.update",
      targetType: "policy",
      safeTargetReference: `mailbox:G${"A".repeat(55)}:policy`,
      result: "success",
      requestId: "req-abc-123",
    });
    expect(logData.timestamp).toBeDefined();
    expect(() => new Date(logData.timestamp).toISOString()).not.toThrow();
  });

  it("emits a structured audit event for a denied security-sensitive action", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    recordAuditEvent({
      actor: `G${"B".repeat(55)}`,
      action: "delegation.authorize",
      targetType: "mailbox",
      safeTargetReference: `mailbox:G${"A".repeat(55)}`,
      result: "denied",
      requestId: "req-denied-456",
    });

    expect(console.info).toHaveBeenCalledOnce();
    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);

    expect(logData.result).toBe("denied");
    expect(logData._audit).toBe(true);
    expect(logData.action).toBe("delegation.authorize");
  });

  it("excludes message content and secrets from audit records", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    recordAuditEvent({
      actor: `G${"A".repeat(55)}`,
      action: "postage.submit",
      targetType: "postage",
      safeTargetReference: `postage:${"a".repeat(64)}`,
      result: "success",
      requestId: "req-789",
    });

    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);

    expect(logData).not.toHaveProperty("secret");
    expect(logData).not.toHaveProperty("messageContent");
    expect(logData).not.toHaveProperty("seed");
    expect(logData).not.toHaveProperty("privateKey");
  });

  it("uses a generated ISO timestamp when none is provided", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const before = new Date().toISOString();

    recordAuditEvent({
      actor: `G${"A".repeat(55)}`,
      action: "receipt.publish",
      targetType: "receipt",
      safeTargetReference: `receipt:${"b".repeat(64)}`,
      result: "success",
      requestId: "req-ts-test",
    });

    const after = new Date().toISOString();
    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);

    expect(logData.timestamp >= before).toBe(true);
    expect(logData.timestamp <= after).toBe(true);
  });

  it("accepts an explicit Date as timestamp", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const ts = new Date("2026-01-01T00:00:00.000Z");

    recordAuditEvent({
      actor: `G${"A".repeat(55)}`,
      action: "policy.update",
      targetType: "policy",
      safeTargetReference: `mailbox:G${"A".repeat(55)}:policy`,
      result: "success",
      requestId: "req-explicit-ts",
      timestamp: ts,
    });

    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    expect(logData.timestamp).toBe("2026-01-01T00:00:00.000Z");
  });

  it("rejects an invalid result value via schema validation", () => {
    expect(() => {
      recordAuditEvent({
        actor: `G${"A".repeat(55)}`,
        action: "policy.update",
        targetType: "policy",
        safeTargetReference: `mailbox:G${"A".repeat(55)}:policy`,
        result: "unknown" as any,
        requestId: "req-bad",
      });
    }).toThrow();
  });

  it("conforms output to the auditEventSchema", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});

    recordAuditEvent({
      actor: `G${"A".repeat(55)}`,
      action: "senderRule.update",
      targetType: "senderRule",
      safeTargetReference: `mailbox:G${"A".repeat(55)}:senders:G${"B".repeat(55)}`,
      result: "success",
      requestId: "req-schema-check",
    });

    const logData = JSON.parse(vi.mocked(console.info).mock.calls[0][0] as string);
    const { _audit, ...eventFields } = logData;

    expect(_audit).toBe(true);
    expect(() => auditEventSchema.parse(eventFields)).not.toThrow();
  });
});
