import { describe, expect, it } from "vitest";
import { inboxSeedDataset, inboxSeedMessages } from "../fixtures/inboxSeedDataset";
import { validateInboxSeedDataset } from "../seedDatasetValidation";
import type { DemoDataset, DemoMessage, DemoSender } from "../types/dataset";

describe("validateInboxSeedDataset", () => {
  it("returns no errors for the canonical seed dataset", () => {
    const issues = validateInboxSeedDataset(inboxSeedDataset);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
  });

  it("reports missing message id", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], id: "" }],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.fieldPath === "messages[0].id")).toBe(true);
  });

  it("reports duplicate message ids", () => {
    const msg = inboxSeedMessages[0];
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [msg, { ...msg }],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.id?.includes("duplicate"))).toBe(true);
  });

  it("reports missing body", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], body: "" }],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.fieldPath === "messages[0].body")).toBe(true);
  });

  it("reports invalid proof status", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [
        {
          ...inboxSeedMessages[0],
          proofRecord: {
            ...inboxSeedMessages[0].proofRecord!,
            status: "bogus" as "verified" | "pending" | "failed" | "none",
          },
        },
      ],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.id?.includes("proof-status"))).toBe(true);
  });

  it("reports unsafe sender domain", () => {
    const sender: DemoSender = {
      address: "attacker@phishing.xyz",
      name: "Bad Actor",
      isTrusted: false,
    };
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], sender }],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.id?.includes("sender-domain"))).toBe(true);
  });

  it("reports duplicate sender addresses", () => {
    const sender = inboxSeedDataset.senders![0];
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      senders: [sender, sender],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.id?.includes("sender-1-duplicate"))).toBe(true);
  });

  it("returns empty array for an empty dataset message list", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [],
    };
    const issues = validateInboxSeedDataset(dataset);
    expect(issues.some((i) => i.id?.includes("empty"))).toBe(true);
  });

  it("reports warning for message with no subject", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], subject: "" }],
    };
    const issues = validateInboxSeedDataset(dataset);
    const subjectIssue = issues.find((i) => i.fieldPath === "messages[0].subject");
    expect(subjectIssue).toBeDefined();
    expect(subjectIssue!.severity).toBe("warning");
    expect(subjectIssue!.message).toContain("has no subject");
  });

  it("reports error for invalid message date format", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], date: "invalid-date-format" }],
    };
    const issues = validateInboxSeedDataset(dataset);
    const dateIssue = issues.find((i) => i.fieldPath === "messages[0].date");
    expect(dateIssue).toBeDefined();
    expect(dateIssue!.severity).toBe("error");
    expect(dateIssue!.message).toContain("invalid date");
  });

  it("reports warning for unsafe recipient domain", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [{ ...inboxSeedMessages[0], recipients: ["eve@unverified.com"] }],
    };
    const issues = validateInboxSeedDataset(dataset);
    const recipientIssue = issues.find((i) => i.fieldPath === "messages[0].recipients[0]");
    expect(recipientIssue).toBeDefined();
    expect(recipientIssue!.severity).toBe("warning");
    expect(recipientIssue!.message).toContain("uses an unsafe domain");
  });

  it("reports error for potential secret pattern in message body", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [
        {
          ...inboxSeedMessages[0],
          body: "Here is my Stellar secret key: SAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        },
      ],
    };
    const issues = validateInboxSeedDataset(dataset);
    const bodyIssue = issues.find((i) => i.fieldPath === "messages[0].body");
    expect(bodyIssue).toBeDefined();
    expect(bodyIssue!.severity).toBe("error");
    expect(bodyIssue!.message).toContain("may contain a secret");
  });

  it("reports error for invalid proof record timestamp", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      messages: [
        {
          ...inboxSeedMessages[0],
          proofRecord: {
            ...inboxSeedMessages[0].proofRecord!,
            timestamp: "not-iso-date",
          },
        },
      ],
    };
    const issues = validateInboxSeedDataset(dataset);
    const proofTimeIssue = issues.find((i) => i.fieldPath === "messages[0].proofRecord.timestamp");
    expect(proofTimeIssue).toBeDefined();
    expect(proofTimeIssue!.severity).toBe("error");
    expect(proofTimeIssue!.message).toContain("is not ISO 8601");
  });

  it("reports warning for unsafe sender domain in senders list", () => {
    const dataset: DemoDataset = {
      ...inboxSeedDataset,
      senders: [
        {
          address: "unsafe@malicious.domain.com",
          name: "Unsafe Sender",
          isTrusted: false,
        },
      ],
    };
    const issues = validateInboxSeedDataset(dataset);
    const senderIssue = issues.find((i) => i.fieldPath === "senders[0].address");
    expect(senderIssue).toBeDefined();
    expect(senderIssue!.severity).toBe("warning");
    expect(senderIssue!.message).toContain("uses an unsafe domain");
  });
});
