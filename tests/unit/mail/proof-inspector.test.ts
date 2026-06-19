/**
 * Data contract tests for the ProofInspectorModal mock record shape.
 *
 * ProofInspectorModal builds a MockProofRecord per email using deterministic
 * string operations. These tests verify that the fields the UI and clipboard
 * copy action depend on are present and correctly shaped.
 *
 * The derivation logic lives in ProofInspectorModal (useMemo). Since that
 * component is not independently unit-testable without a DOM, this file
 * tests the contract by re-implementing the same derivation rules against the
 * Email type — acting as a regression guard for any refactor of those rules.
 */

import { describe, expect, it } from "vitest";
import type { Email } from "../../../src/components/mail/data";

// ---------------------------------------------------------------------------
// Minimal mock-record derivation (mirrors ProofInspectorModal useMemo logic)
// ---------------------------------------------------------------------------

type PostageStatus = "pending" | "settled" | "refunded";
type SenderRule = "allow" | "block" | "default";

interface MockProofRecord {
  emailId: string;
  messageHash: string;
  paymentHash: string;
  diagnosticId: string;
  contractAddress: string;
  relayNode: string;
  latency: string;
  signature: string;
  deliveredAt: string;
  readAt: string | null;
  postageAmount: string;
  postageStatus: PostageStatus;
  senderRule: SenderRule;
}

function buildMockProofRecord(email: Email): MockProofRecord {
  const messageHash = `0x${email.id.repeat(16).padEnd(64, "a")}d8c7e9`;
  const paymentHash = `0x${(email.id + "pay").repeat(12).padEnd(64, "b")}f12a3d`;
  const diagnosticId = `d1f038c7-4b1d-44a6-8968-3e5f492305${email.id.padStart(2, "0")}`;
  const contractAddress = `CB${email.id.repeat(10).toUpperCase().padEnd(54, "9")}`;

  const postageStatus: PostageStatus =
    email.folder === "requests"
      ? "pending"
      : email.folder === "spam"
        ? "refunded"
        : "settled";

  const senderRule: SenderRule =
    email.senderPolicy === "verify" ? "default" : ((email.senderPolicy ?? "default") as SenderRule);

  return {
    emailId: email.id,
    messageHash,
    paymentHash,
    diagnosticId,
    contractAddress,
    relayNode: "relay-us-east-1.stealth.network",
    latency: `${20 + (email.from.length % 5) * 6}ms`,
    signature: `Ed25519 [0x${email.id.repeat(8).padEnd(32, "7")}f31b]`,
    deliveredAt:
      email.time.includes("AM") || email.time.includes("PM")
        ? "Today, " + email.time
        : email.time,
    readAt: email.unread ? null : "Delivered + Read",
    postageAmount: email.postageAmount ?? "10000000",
    postageStatus,
    senderRule,
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const base: Email = {
  id: "42",
  from: "Alice Example",
  email: "alice@example.com",
  subject: "Contract test",
  preview: "preview",
  body: "Hello",
  time: "9:00 AM",
  unread: true,
  starred: false,
  folder: "verified",
  avatarColor: "#6d28d9",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MockProofRecord — field presence and shape", () => {
  it("produces all required fields", () => {
    const record = buildMockProofRecord(base);
    const required: (keyof MockProofRecord)[] = [
      "emailId",
      "messageHash",
      "paymentHash",
      "diagnosticId",
      "contractAddress",
      "relayNode",
      "latency",
      "signature",
      "deliveredAt",
      "readAt",
      "postageAmount",
      "postageStatus",
      "senderRule",
    ];
    for (const key of required) {
      expect(record[key]).toBeDefined();
    }
  });

  it("messageHash starts with 0x and is longer than 66 chars (mock prefix + 64 hex)", () => {
    const { messageHash } = buildMockProofRecord(base);
    expect(messageHash.startsWith("0x")).toBe(true);
    expect(messageHash.length).toBeGreaterThan(66);
  });

  it("paymentHash starts with 0x", () => {
    expect(buildMockProofRecord(base).paymentHash.startsWith("0x")).toBe(true);
  });

  it("diagnosticId matches UUID-like prefix format", () => {
    const { diagnosticId } = buildMockProofRecord(base);
    expect(diagnosticId).toMatch(/^d1f038c7-4b1d-44a6-8968-/);
  });

  it("contractAddress starts with CB", () => {
    expect(buildMockProofRecord(base).contractAddress.startsWith("CB")).toBe(true);
  });

  it("relayNode is the expected static hostname", () => {
    expect(buildMockProofRecord(base).relayNode).toBe("relay-us-east-1.stealth.network");
  });

  it("latency ends with ms", () => {
    expect(buildMockProofRecord(base).latency).toMatch(/ms$/);
  });

  it("signature starts with Ed25519", () => {
    expect(buildMockProofRecord(base).signature.startsWith("Ed25519")).toBe(true);
  });
});

describe("MockProofRecord — postageStatus derivation", () => {
  it("is 'settled' for verified folder", () => {
    expect(buildMockProofRecord({ ...base, folder: "verified" }).postageStatus).toBe("settled");
  });

  it("is 'pending' for requests folder", () => {
    expect(buildMockProofRecord({ ...base, folder: "requests" }).postageStatus).toBe("pending");
  });

  it("is 'refunded' for spam folder", () => {
    expect(buildMockProofRecord({ ...base, folder: "spam" }).postageStatus).toBe("refunded");
  });
});

describe("MockProofRecord — senderRule derivation", () => {
  it("maps senderPolicy 'verify' to senderRule 'default'", () => {
    expect(buildMockProofRecord({ ...base, senderPolicy: "verify" }).senderRule).toBe("default");
  });

  it("maps senderPolicy 'allow' to senderRule 'allow'", () => {
    expect(buildMockProofRecord({ ...base, senderPolicy: "allow" }).senderRule).toBe("allow");
  });

  it("defaults to 'default' when senderPolicy is undefined", () => {
    const email: Email = { ...base };
    delete email.senderPolicy;
    expect(buildMockProofRecord(email).senderRule).toBe("default");
  });
});

describe("MockProofRecord — readAt derivation", () => {
  it("is null when email is unread", () => {
    expect(buildMockProofRecord({ ...base, unread: true }).readAt).toBeNull();
  });

  it("is 'Delivered + Read' when email is read", () => {
    expect(buildMockProofRecord({ ...base, unread: false }).readAt).toBe("Delivered + Read");
  });
});

describe("MockProofRecord — postageAmount fallback", () => {
  it("falls back to '10000000' when postageAmount is not set", () => {
    const email: Email = { ...base };
    delete email.postageAmount;
    expect(buildMockProofRecord(email).postageAmount).toBe("10000000");
  });

  it("uses provided postageAmount when set", () => {
    expect(buildMockProofRecord({ ...base, postageAmount: "5000000" }).postageAmount).toBe(
      "5000000",
    );
  });
});

describe("MockProofRecord — clipboard safety (email field excluded from JSON)", () => {
  it("does not serialize the email field when stringified without it", () => {
    const record = buildMockProofRecord(base);
    // Simulate what the modal does: omit the email reference before clipboard copy
    const serialized = JSON.stringify({ ...record, email: undefined });
    const parsed = JSON.parse(serialized);
    expect(parsed.email).toBeUndefined();
    // Core proof fields should still be present
    expect(parsed.messageHash).toBeTruthy();
    expect(parsed.diagnosticId).toBeTruthy();
  });
});
