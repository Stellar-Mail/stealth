import { describe, expect, it } from "vitest";
import {
  buildSequence,
  isSequenceDuplicate,
  summarizeSequence,
  MAX_SCAN_LENGTH,
  type SequenceBuildInput,
} from "../services/followUpSequenceBuilder";
import { sampleInputs } from "../services/fixtures";

function input(overrides: Partial<SequenceBuildInput> = {}): SequenceBuildInput {
  return {
    messageId: "msg-test",
    subject: "Follow up on proposal",
    body: "Please get back to me on this soon.",
    senderAddress: "person@example.com",
    receivedAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildSequence", () => {
  it("creates a high-confidence sequence for urgent requests with deadlines", () => {
    const seq = buildSequence(sampleInputs.urgentWithDeadline);
    expect(seq.confidence).toBe("high");
    expect(seq.urgency).toBe("critical");
    expect(seq.steps.length).toBeGreaterThan(0);
    expect(seq.steps[0].delayDays).toBe(1);
    expect(seq.sourceMessageId).toBe("msg-2001");
    expect(seq.warnings).toHaveLength(0);
  });

  it("creates a medium-confidence sequence for explicit requests without urgency", () => {
    const seq = buildSequence(sampleInputs.explicitNoUrgency);
    expect(seq.confidence).toBe("medium");
    expect(seq.steps.length).toBeGreaterThan(0);
    expect(seq.warnings).toHaveLength(0);
  });

  it("returns no sequence for low-priority FYI contexts", () => {
    const seq = buildSequence(sampleInputs.lowPriorityFyi);
    expect(seq.confidence).toBe("low");
    expect(seq.steps).toHaveLength(0);
    expect(seq.warnings.some((w) => w.toLowerCase().includes("low-priority"))).toBe(true);
  });

  it("returns no sequence when there is no actionable signal", () => {
    const seq = buildSequence(sampleInputs.noSignal);
    expect(seq.confidence).toBe("low");
    expect(seq.steps).toHaveLength(0);
    expect(seq.warnings.some((w) => w.toLowerCase().includes("no actionable"))).toBe(true);
  });

  it("creates a critical-urgency sequence for critical requests", () => {
    const seq = buildSequence(sampleInputs.criticalWithDeadline);
    expect(seq.confidence).toBe("high");
    expect(seq.urgency).toBe("critical");
    expect(seq.steps.length).toBeGreaterThan(0);
    expect(seq.steps[0].delayDays).toBe(1);
  });

  it("creates a normal-urgency sequence for touch-base check-ins with low-priority context", () => {
    const seq = buildSequence(sampleInputs.gentleCheckIn);
    expect(seq.confidence).toBe("medium");
    expect(seq.urgency).toBe("normal");
    expect(seq.steps.length).toBeGreaterThan(0);
    expect(seq.warnings.some((w) => w.toLowerCase().includes("low-priority"))).toBe(true);
  });

  it("respects the maxSteps option", () => {
    const seq = buildSequence(sampleInputs.urgentWithDeadline, { maxSteps: 2 });
    expect(seq.steps.length).toBeLessThanOrEqual(2);
  });

  it("warns when a sequence already exists for the same message", () => {
    const seq = buildSequence(sampleInputs.normalFollowUp, {
      existingSequences: [{ sourceMessageId: "msg-2002", title: "Existing sequence" }],
    });
    expect(seq.warnings.some((w) => w.toLowerCase().includes("already exists"))).toBe(true);
  });

  it("detects duplicate sequences", () => {
    const seq = buildSequence(sampleInputs.normalFollowUp);
    expect(isSequenceDuplicate(seq, [{ sourceMessageId: "msg-2002", title: seq.title }])).toBe(
      true,
    );
  });

  it("does not flag different messages as duplicates", () => {
    const seq = buildSequence(sampleInputs.normalFollowUp);
    expect(isSequenceDuplicate(seq, [{ sourceMessageId: "msg-other", title: "Other" }])).toBe(
      false,
    );
  });

  it("is deterministic for the same input", () => {
    const first = buildSequence(sampleInputs.normalFollowUp);
    const second = buildSequence(sampleInputs.normalFollowUp);
    expect(first).toEqual(second);
  });

  it("bounds scanning and does not crash for very long messages", () => {
    const seq = buildSequence(
      input({
        subject: "Notes",
        body: "a".repeat(MAX_SCAN_LENGTH) + " asap deadline: 2026-09-09 critical urgent follow up",
      }),
    );
    expect(seq.confidence).toBe("low");
    expect(seq.steps).toHaveLength(0);
  });

  it("generates pending steps with correct structure", () => {
    const seq = buildSequence(sampleInputs.urgentWithDeadline);
    for (const step of seq.steps) {
      expect(step.stage).toBe("pending");
      expect(step.order).toBeGreaterThan(0);
      expect(step.delayDays).toBeGreaterThan(0);
      expect(step.template).toBeTruthy();
      expect(step.condition).toBeTruthy();
    }
  });

  it("uses consecutive ordering for steps", () => {
    const seq = buildSequence(sampleInputs.urgentWithDeadline);
    for (let i = 0; i < seq.steps.length; i++) {
      expect(seq.steps[i].order).toBe(i + 1);
    }
  });

  it("sets urgency to high when deadline is present without urgency keywords", () => {
    const seq = buildSequence(
      input({
        subject: "Contract deadline 2026-08-15",
        body: "Please follow up on the contract. The deadline is 2026-08-15.",
      }),
    );
    expect(seq.urgency).toBe("high");
  });
});

describe("summarizeSequence", () => {
  it("summarizes a sequence with steps", () => {
    const seq = buildSequence(sampleInputs.urgentWithDeadline);
    const summary = summarizeSequence(seq);
    expect(summary).toContain("steps");
    expect(summary).toContain(seq.confidence);
    expect(summary).toContain(seq.urgency);
  });

  it("summarizes a no-sequence result", () => {
    const seq = buildSequence(sampleInputs.lowPriorityFyi);
    expect(summarizeSequence(seq)).toContain("No sequence suggested");
  });
});
