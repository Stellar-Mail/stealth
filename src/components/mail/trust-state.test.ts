import { describe, it, expect } from "vitest";
import { getTrustStates, getPrimaryTrustState } from "./trust-state";
import type { Email } from "./data";

function makeEmail(overrides: Partial<Email>): Email {
  return {
    id: "1",
    from: "Ada",
    email: "ada@demo.stealth",
    subject: "Subject",
    preview: "Preview",
    body: "Body",
    time: "Now",
    unread: false,
    starred: false,
    folder: "inbox",
    avatarColor: "#ffffff",
    ...overrides,
  };
}

describe("getTrustStates", () => {
  it("returns unknown for a plain inbox message", () => {
    expect(getTrustStates(makeEmail({}))).toEqual(["unknown"]);
  });

  it("returns blocked for a blocked sender policy", () => {
    expect(getTrustStates(makeEmail({ senderPolicy: "block" }))).toEqual(["blocked"]);
  });

  it("returns allowed for an allowed sender policy", () => {
    expect(getTrustStates(makeEmail({ senderPolicy: "allow" }))).toEqual(["allowed"]);
  });

  it("marks verified senders", () => {
    expect(getTrustStates(makeEmail({ verifiedSender: true }))).toContain("verified");
  });

  it("derives verified from a verified folder", () => {
    expect(getTrustStates(makeEmail({ folder: "verified" }))).toContain("verified");
  });

  it("derives encrypted from the encrypted folder", () => {
    const states = getTrustStates(makeEmail({ folder: "encrypted" }));
    expect(states).toContain("encrypted");
    expect(states).toContain("verified");
  });

  it("detects bridged and paid from labels", () => {
    const states = getTrustStates(makeEmail({ labels: ["Bridge", "Paid"] }));
    expect(states).toContain("bridged");
    expect(states).toContain("paid");
  });

  it("detects paid from a postage amount", () => {
    expect(getTrustStates(makeEmail({ postageAmount: "0.5 XLM" }))).toContain("paid");
  });

  it("does not produce duplicate states", () => {
    const states = getTrustStates(makeEmail({ folder: "verified", verifiedSender: true }));
    expect(new Set(states).size).toBe(states.length);
  });

  it("prioritizes the explicit policy as the primary state", () => {
    expect(getPrimaryTrustState(makeEmail({ senderPolicy: "allow", folder: "verified" }))).toBe(
      "allowed",
    );
  });
});
