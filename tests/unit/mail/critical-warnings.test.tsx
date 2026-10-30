// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getCriticalMailWarning } from "@/features/mail/critical-warnings";
import { defaultCriticalAlerts } from "@/features/preferences/types";
import { resolveStoredPreferences } from "@/features/preferences/usePreferences";
import { EmailView } from "@/components/mail/EmailView";
import type { Email } from "@/components/mail/data";
import type { MailThread } from "@/features/mail/live-thread";

afterEach(cleanup);
const email: Email = {
  id: "warning-test",
  from: "A sender",
  email: "sender@example.com",
  subject: "A message",
  preview: "Preview",
  body: "PRIVATE_SENSITIVE_TEXT",
  time: "9:42 AM",
  unread: false,
  starred: false,
  folder: "inbox",
  avatarColor: "#789b47",
};
const enabled = { ...defaultCriticalAlerts, enabled: true };

describe("Optional critical warnings", () => {
  it("stays quiet by default even for authenticity failures", () => {
    expect(getCriticalMailWarning(email, undefined, "Signature mismatch")).toBeNull();
    expect(getCriticalMailWarning(email, defaultCriticalAlerts, "Signature mismatch")).toBeNull();
  });
  it("flags unknown senders only when configured, without flagging verified or allowed contacts", () => {
    expect(getCriticalMailWarning(email, enabled)).toContain("not verified");
    expect(getCriticalMailWarning({ ...email, verifiedSender: true }, enabled)).toBeNull();
    expect(getCriticalMailWarning({ ...email, senderPolicy: "allow" }, enabled)).toBeNull();
    expect(getCriticalMailWarning(email, { ...enabled, unknownSenders: false })).toBeNull();
  });
  it("prioritizes actual verification failures even for an allowed sender", () => {
    expect(
      getCriticalMailWarning({ ...email, senderPolicy: "allow" }, enabled, "Signature mismatch"),
    ).toBe("Signature mismatch");
    expect(
      getCriticalMailWarning(
        email,
        { ...enabled, unknownSenders: false, failedVerification: false },
        "Signature mismatch",
      ),
    ).toBeNull();
  });
  it("merges old and partial stored preferences with safe boolean defaults", () => {
    expect(
      resolveStoredPreferences(JSON.stringify({ criticalAlerts: { enabled: true } }), null)
        .preferences.criticalAlerts,
    ).toEqual(enabled);
    expect(
      resolveStoredPreferences(
        JSON.stringify({ criticalAlerts: { enabled: "true", unknownSenders: false } }),
        null,
      ).preferences.criticalAlerts,
    ).toEqual({ ...defaultCriticalAlerts, unknownSenders: false });
  });
  it("removes routine proof cards without allowing quarantined content to render", () => {
    const thread: MailThread = {
      threadId: "thread",
      subject: email.subject,
      selectedId: email.id,
      mixedState: false,
      messages: [
        {
          messageId: email.id,
          createdAt: "2026-10-07T12:00:00Z",
          subject: email.subject,
          senderId: "sender",
          recipientId: "recipient",
          trust: "quarantined",
          authenticityWarning: "Signature mismatch",
          sender: email.from,
          timestamp: "2026-10-07T12:00:00Z",
          attachments: [],
          remoteResources: { blockedUrls: [], blockedCount: 0 },
          encryptedPayload: { status: "failed", diagnosticId: "diagnostic" },
        },
      ],
    };
    const { rerender } = render(<EmailView email={email} thread={thread} />);
    expect(screen.queryByText(email.body)).toBeNull();
    expect(screen.queryByText("Signature mismatch")).toBeNull();
    expect(screen.queryByText("Authenticity not verified")).toBeNull();
    expect(screen.queryByText("proof unavailable")).toBeNull();
    expect(screen.queryByText("Unknown", { exact: true })).toBeNull();
    expect(
      screen.getByText("Message body is hidden until the envelope verifies and decrypts."),
    ).not.toBeNull();
    rerender(<EmailView email={email} thread={thread} criticalAlerts={enabled} />);
    expect(screen.getByRole("alert").textContent).toBe("Signature mismatch");
    expect(screen.queryByText(email.body)).toBeNull();
  });
});
