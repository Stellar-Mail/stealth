import { describe, it, expect, beforeEach } from "vitest";
import { NotificationAuditTrail } from "../../../src/services/notifications/audit-trail";

describe("BETA-005: Notification Audit Trail", () => {
  let auditTrail: NotificationAuditTrail;

  beforeEach(() => {
    auditTrail = new NotificationAuditTrail(50);
    auditTrail.clear();
  });

  it("records delivery events with increasing sequence IDs and valid timestamps", async () => {
    const event = await auditTrail.recordEvent({
      eventType: "delivery.dispatched",
      transport: "smtp",
      safeTargetReference: "hash_alice_123",
      durationMs: 45,
      metadata: { priority: "high" },
    });

    expect(event.sequenceId).toBe(1);
    expect(event.eventType).toBe("delivery.dispatched");
    expect(event.transport).toBe("smtp");
    expect(event.safeTargetReference).toBe("hash_alice_123");
    expect(event.durationMs).toBe(45);
    expect(event.recordHash).toBeDefined();
    expect(event.previousHash).toContain("GENESIS_AUDIT_BLOCK");
  });

  it("creates a cryptographically-linked chain across multiple events", async () => {
    const event1 = await auditTrail.recordEvent({
      eventType: "delivery.dispatched",
      transport: "smtp",
      safeTargetReference: "ref_1",
      durationMs: 10,
    });

    const event2 = await auditTrail.recordEvent({
      eventType: "delivery.succeeded",
      transport: "smtp",
      safeTargetReference: "ref_1",
      providerRef: "smtp-msg-001",
      durationMs: 120,
    });

    expect(event2.sequenceId).toBe(2);
    expect(event2.previousHash).toBe(event1.recordHash);

    const isValid = await auditTrail.verifyChainIntegrity();
    expect(isValid).toBe(true);
  });

  it("detects tampering when an event hash is corrupted", async () => {
    await auditTrail.recordEvent({
      eventType: "delivery.dispatched",
      transport: "smtp",
      safeTargetReference: "ref_1",
      durationMs: 10,
    });

    await auditTrail.recordEvent({
      eventType: "delivery.succeeded",
      transport: "smtp",
      safeTargetReference: "ref_1",
      durationMs: 50,
    });

    // Mutate internal state to simulate tampering
    (auditTrail as any).events[0].durationMs = 9999;

    const isValid = await auditTrail.verifyChainIntegrity();
    expect(isValid).toBe(false);
  });

  it("produces accurate statistical summaries", async () => {
    await auditTrail.recordEvent({
      eventType: "delivery.succeeded",
      transport: "smtp",
      safeTargetReference: "ref_a",
      durationMs: 100,
    });

    await auditTrail.recordEvent({
      eventType: "delivery.failed",
      transport: "smtp",
      safeTargetReference: "ref_b",
      durationMs: 200,
    });

    await auditTrail.recordEvent({
      eventType: "delivery.succeeded",
      transport: "sink",
      safeTargetReference: "ref_c",
      durationMs: 10,
    });

    const summary = await auditTrail.getSummary();
    expect(summary.totalEvents).toBe(3);
    expect(summary.successfulDeliveries).toBe(2);
    expect(summary.failedDeliveries).toBe(1);
    expect(summary.averageLatencyMs).toBe(103);
    expect(summary.transportBreakdown.smtp).toBe(2);
    expect(summary.transportBreakdown.sink).toBe(1);
    expect(summary.verifiedChainIntegrity).toBe(true);
  });

  it("filters events by safe target reference", async () => {
    await auditTrail.recordEvent({
      eventType: "delivery.dispatched",
      transport: "smtp",
      safeTargetReference: "target_target_alpha",
      durationMs: 20,
    });

    await auditTrail.recordEvent({
      eventType: "delivery.dispatched",
      transport: "smtp",
      safeTargetReference: "target_target_beta",
      durationMs: 30,
    });

    const alphaEvents = auditTrail.findEventsByTarget("target_target_alpha");
    expect(alphaEvents).toHaveLength(1);
    expect(alphaEvents[0].safeTargetReference).toBe("target_target_alpha");
  });
});
