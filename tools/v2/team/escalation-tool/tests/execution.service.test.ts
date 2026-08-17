import { describe, expect, it } from "vitest";

import {
  createEscalationToolService,
  escalationToolService,
  failingRepository,
  invalidPriorityInput,
  missingConversationIdInput,
  missingReasonInput,
  successfulEscalationInput,
} from "../index";

describe("escalationToolService execution contract", () => {
  it("executes successfully with valid input", async () => {
    const result = await escalationToolService.execute(successfulEscalationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.conversationId).toBe("conv-102938");
    expect(result.data.reason).toBe(successfulEscalationInput.reason);
    expect(result.data.priority).toBe("high");
    expect(result.data.requestedBy).toBe("agent-alice-42");
    expect(result.data.targetDepartment).toBe("compliance");
    expect(result.data.status).toBe("open");
    expect(result.data.correlationId).toBe("corr-778899");
    expect(result.data.id).toBeTruthy();
    expect(result.data.createdAt).toBeTruthy();
  });

  it("fails validation when conversationId is empty or whitespace", async () => {
    const result = await escalationToolService.execute(missingConversationIdInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.field).toBe("conversationId");
  });

  it("fails validation when reason is empty", async () => {
    const result = await escalationToolService.execute(missingReasonInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.field).toBe("reason");
  });

  it("fails validation when priority is invalid", async () => {
    const result = await escalationToolService.execute(invalidPriorityInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_PRIORITY");
    expect(result.error.field).toBe("priority");
  });

  it("propagates persistence failure when repository throws", async () => {
    const service = createEscalationToolService({ repository: failingRepository });
    const result = await service.execute(successfulEscalationInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("PERSISTENCE_FAILED");
    expect(result.error.message).toContain("persisted");
  });

  it("uses custom clock and generateId dependencies when injected", async () => {
    const customTime = new Date("2026-06-01T12:00:00.000Z");
    const service = createEscalationToolService({
      generateId: () => "custom-esc-id-123",
      now: () => customTime,
    });

    const result = await service.execute(successfulEscalationInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.id).toBe("custom-esc-id-123");
    expect(result.data.createdAt).toBe("2026-06-01T12:00:00.000Z");
  });
});
