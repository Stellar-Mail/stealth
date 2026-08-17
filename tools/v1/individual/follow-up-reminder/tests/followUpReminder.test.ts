import { describe, expect, it } from "vitest";
import {
  buildFollowUpReminder,
  isReminderDuplicate,
  summarizeReminder,
  MAX_SCAN_LENGTH,
  type NormalizedEmailInput,
} from "../services/followUpReminder";
import { sampleEmails } from "../services/fixtures";

function emailInput(overrides: Partial<NormalizedEmailInput> = {}): NormalizedEmailInput {
  return {
    messageId: "msg-test",
    subject: "Sync",
    body: "Hello there.",
    senderAddress: "person@example.com",
    receivedAt: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildFollowUpReminder", () => {
  it("creates a high-confidence draft from an explicit request with a clear date", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitWithDate);
    expect(model.state).toBe("draft");
    expect(model.confidence).toBe("high");
    expect(model.dueAt).toBe("2026-02-10");
    expect(model.sourceMessageId).toBe("msg-1001");
    expect(model.signals.some((s) => s.type === "explicit_request")).toBe(true);
    expect(model.signals.some((s) => s.type === "absolute_date")).toBe(true);
  });

  it("resolves a relative date using the received time as the base", () => {
    const model = buildFollowUpReminder(sampleEmails.relativeNextWeek);
    expect(model.dueAt).toBe("2026-02-08");
    expect(model.state).toBe("draft");
    expect(model.signals.some((s) => s.type === "relative_date")).toBe(true);
  });

  it("returns a draft with a warning when the due date is ambiguous", () => {
    const model = buildFollowUpReminder(sampleEmails.ambiguousDates);
    expect(model.state).toBe("draft");
    expect(model.dueAt).toBeNull();
    expect(model.confidence).toBe("medium");
    expect(model.warnings.some((w) => w.toLowerCase().includes("ambiguous"))).toBe(true);
  });

  it("suggests no reminder for low-confidence contexts", () => {
    const model = buildFollowUpReminder(sampleEmails.newsletter);
    expect(model.state).toBe("no_action");
    expect(model.confidence).toBe("low");
  });

  it("suggests no reminder when there is no actionable signal", () => {
    const model = buildFollowUpReminder(sampleEmails.noSignal);
    expect(model.state).toBe("no_action");
    expect(model.warnings.some((w) => w.toLowerCase().includes("no actionable"))).toBe(true);
  });

  it("keeps an explicit request as a draft but flags the missing due date", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitNoDate);
    expect(model.state).toBe("draft");
    expect(model.dueAt).toBeNull();
    expect(model.confidence).toBe("medium");
    expect(model.warnings.some((w) => w.toLowerCase().includes("no due date"))).toBe(true);
  });

  it("warns when a relative date is resolved without a timezone", () => {
    const model = buildFollowUpReminder(
      emailInput({
        messageId: "msg-2001",
        subject: "Please reply by tomorrow",
        body: "Remind me to follow up tomorrow.",
      }),
    );
    expect(model.dueAt).toBe("2026-05-02");
    expect(model.warnings.some((w) => w.toLowerCase().includes("timezone"))).toBe(true);
  });

  it("resolves word-based relative dates such as in two days", () => {
    const model = buildFollowUpReminder(
      emailInput({
        body: "Let us follow up in two days about the launch.",
        timeZone: "UTC",
      }),
    );
    expect(model.dueAt).toBe("2026-05-03");
  });

  it("avoids duplicate reminders for the same message and due date", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitWithDate, {
      existingReminders: [{ sourceMessageId: "msg-1001", dueAt: "2026-02-10" }],
    });
    expect(model.state).toBe("no_action");
    expect(model.warnings.some((w) => w.toLowerCase().includes("already exists"))).toBe(true);
  });

  it("is deterministic for the same input", () => {
    const first = buildFollowUpReminder(sampleEmails.explicitWithDate);
    const second = buildFollowUpReminder(sampleEmails.explicitWithDate);
    expect(first).toEqual(second);
  });

  it("bounds date scanning for very long messages", () => {
    const model = buildFollowUpReminder(
      emailInput({
        subject: "Notes",
        body: "a".repeat(MAX_SCAN_LENGTH) + " 2026-09-09",
      }),
    );
    expect(model.dueAt).toBeNull();
  });
});

describe("isReminderDuplicate", () => {
  it("detects an existing reminder with the same message and due date", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitWithDate);
    expect(isReminderDuplicate(model, [{ sourceMessageId: "msg-1001", dueAt: "2026-02-10" }])).toBe(
      true,
    );
  });

  it("returns false when the due date is null", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitNoDate);
    expect(isReminderDuplicate(model, [{ sourceMessageId: "msg-1006", dueAt: null }])).toBe(false);
  });
});

describe("summarizeReminder", () => {
  it("summarizes a draft with its due date", () => {
    const model = buildFollowUpReminder(sampleEmails.explicitWithDate);
    expect(summarizeReminder(model)).toContain("2026-02-10");
  });

  it("summarizes a no-action result", () => {
    const model = buildFollowUpReminder(sampleEmails.newsletter);
    expect(summarizeReminder(model)).toContain("No reminder suggested");
  });
});
