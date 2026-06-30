import { describe, expect, it } from "vitest";
import {
  buildSenderIdentityProfile,
  formatPostageAmount,
} from "../../../src/features/identity/types";
import type { Email } from "../../../src/components/mail/data";

const baseEmail: Email = {
  id: "1",
  from: "Lina Park",
  email: "lina@example.com",
  subject: "Brand review",
  preview: "Sharing the latest direction for the new identity system.",
  body: "This body should never be exposed in the profile card.",
  time: "9:42 AM",
  unread: true,
  starred: false,
  folder: "priority",
  avatarColor: "#5b6470",
  receiptState: "sent",
  postageAmount: "10000000",
  verifiedSender: true,
};

describe("formatPostageAmount", () => {
  it("formats stroops as XLM", () => {
    expect(formatPostageAmount("25000000")).toBe("2.5 XLM");
  });

  it("falls back to a safe string when input is invalid", () => {
    expect(formatPostageAmount("not-a-number")).toBe("not-a-number stroops");
  });
});

describe("buildSenderIdentityProfile", () => {
  it("summarizes trust, postage, receipt, and recent conversations without body text", () => {
    const emails: Email[] = [
      baseEmail,
      {
        ...baseEmail,
        id: "2",
        subject: "Follow-up",
        preview: "Please confirm the proof and send a receipt.",
        time: "Yesterday",
        receiptState: "pending",
        postageAmount: "5000000",
        verifiedSender: false,
      },
      {
        ...baseEmail,
        id: "3",
        subject: "Blocked request",
        preview: "Waiting on your policy decision.",
        time: "2 days ago",
        folder: "requests",
        senderPolicy: "block",
        receiptState: "none",
        postageAmount: undefined,
        verifiedSender: false,
      },
    ];

    const profile = buildSenderIdentityProfile(
      {
        emailId: "1",
        sender: "Lina Park",
        address: "lina@example.com",
        currentPolicy: undefined,
      },
      emails,
    );

    expect(profile.conversationCount).toBe(3);
    expect(profile.policyLabel).toBe("Default");
    expect(profile.proofSummary).toMatch(/verified message/i);
    expect(profile.receiptSummary).toMatch(/sent/);
    expect(profile.postageSummary).toMatch(/paid message/i);
    expect(profile.recentConversations[0]).toMatchObject({
      subject: "Brand review",
      preview: "Sharing the latest direction for the new identity system.",
      folderLabel: "Priority",
    });
    expect(JSON.stringify(profile.recentConversations)).not.toContain(
      "This body should never be exposed",
    );
  });

  it("reflects a blocked sender rule in the status summary", () => {
    const profile = buildSenderIdentityProfile(
      {
        emailId: "3",
        sender: "Lina Park",
        address: "lina@example.com",
        currentPolicy: "block",
      },
      [baseEmail],
    );

    expect(profile.statusLabel).toBe("Blocked");
    expect(profile.statusSummary).toMatch(/Spam/i);
  });
});
