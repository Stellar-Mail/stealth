import { describe, expect, it } from "vitest";

import {
  buildFollowUpReminder,
  isReminderDuplicate,
  summarizeReminder,
  type NormalizedEmailInput,
} from "../services/followUpReminder";

// Additional coverage for reminder-engine branches that the existing
// followUpReminder.test.ts does not exercise: thread-hint-only drafts,
// absolute date-times, duplicate-date de-duplication, the low-confidence
// confidence cap, the empty-subject title fallback, and summary/duplicate
// helpers on edge inputs. All folder-local; touches no app code.

function emailInput(overrides: Partial<NormalizedEmailInput> = {}): NormalizedEmailInput {
  return {
    messageId: "msg-cov",
    subject: "Sync",
    body: "Hello there.",
    senderAddress: "person@example.com",
    receivedAt: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildFollowUpReminder edge branches", () => {
  it("treats a thread hint alone as a low-confidence draft with a sender hint", () => {
    const model = buildFollowUpReminder(
      emailInput({
        subject: "Project sync",
        body: "Sharing the latest notes from our call.",
        threadHint: "Re: project sync thread",
      }),
    );

    expect(model.state).toBe("draft");
    expect(model.confidence).toBe("low");
    expect(model.dueAt).toBeNull();
    expect(model.signals.some((s) => s.type === "sender_hint")).toBe(true);
    expect(model.warnings.some((w) => w.toLowerCase().includes("no due date"))).toBe(true);
  });

  it("keeps an explicit request in a low-confidence context as a draft but caps confidence at low", () => {
    const model = buildFollowUpReminder(
      emailInput({
        messageId: "msg-mix",
        subject: "Monthly newsletter",
        body: "This is our newsletter. Please reply by 2026-06-01 if you want to follow up.",
        timeZone: "UTC",
      }),
    );

    expect(model.state).toBe("draft");
    expect(model.dueAt).toBe("2026-06-01");
    expect(model.confidence).toBe("low");
    expect(model.signals.some((s) => s.type === "explicit_request")).toBe(true);
    expect(model.signals.some((s) => s.type === "low_confidence_context")).toBe(true);
  });

  it("captures an absolute date-time once and does not double-count the date portion", () => {
    const model = buildFollowUpReminder(
      emailInput({
        messageId: "msg-dt",
        subject: "Reply by deadline",
        body: "Please respond by 2026-03-20T09:00 with the details.",
        timeZone: "UTC",
      }),
    );

    expect(model.state).toBe("draft");
    expect(model.dueAt).toBe("2026-03-20T09:00");
    expect(model.confidence).toBe("high");
    expect(model.warnings.some((w) => w.toLowerCase().includes("ambiguous"))).toBe(false);
    expect(model.signals.filter((s) => s.type === "absolute_date")).toHaveLength(1);
  });

  it("collapses repeated identical dates into a single unambiguous due date", () => {
    const model = buildFollowUpReminder(
      emailInput({
        messageId: "msg-rep",
        subject: "Reply by 2026-07-15",
        body: "Please respond by 2026-07-15; as noted, reply by 2026-07-15.",
      }),
    );

    expect(model.state).toBe("draft");
    expect(model.dueAt).toBe("2026-07-15");
    expect(model.warnings.some((w) => w.toLowerCase().includes("ambiguous"))).toBe(false);
  });

  it("falls back to a generic title when the subject is empty", () => {
    const model = buildFollowUpReminder(
      emailInput({
        subject: "",
        body: "Please follow up by 2026-08-01 about the invoice.",
        timeZone: "UTC",
      }),
    );

    expect(model.title).toBe("Follow up on email");
    expect(model.state).toBe("draft");
    expect(model.dueAt).toBe("2026-08-01");
  });
});

describe("summarizeReminder on a dateless draft", () => {
  it("describes a draft that still has no due date", () => {
    const model = buildFollowUpReminder(
      emailInput({
        subject: "Please follow up",
        body: "Can you follow up on the proposal soon?",
      }),
    );

    expect(model.state).toBe("draft");
    expect(model.dueAt).toBeNull();

    const summary = summarizeReminder(model);
    expect(summary).toContain("no due date yet");
    expect(summary).toContain(model.title);
  });
});

describe("isReminderDuplicate mismatches", () => {
  it("is false when the message matches but the due date differs", () => {
    const model = buildFollowUpReminder(
      emailInput({
        messageId: "msg-dupdiff",
        subject: "Reply by 2026-09-09",
        body: "Please reply by 2026-09-09.",
      }),
    );

    expect(model.dueAt).toBe("2026-09-09");
    expect(
      isReminderDuplicate(model, [{ sourceMessageId: "msg-dupdiff", dueAt: "2026-01-01" }]),
    ).toBe(false);
    expect(isReminderDuplicate(model, [{ sourceMessageId: "other", dueAt: "2026-09-09" }])).toBe(
      false,
    );
  });
});
