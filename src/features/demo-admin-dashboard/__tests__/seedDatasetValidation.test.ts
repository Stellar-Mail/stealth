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
});
