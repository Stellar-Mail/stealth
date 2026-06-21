import { describe, expect, it } from "vitest";
import type { Email } from "../../../src/components/mail/data";
import {
  generateMockProofRecords,
  validateProofQuery,
  searchProofRecords,
} from "../../../src/features/proof-inspector/utils";

function makeEmail(overrides: Partial<Email>): Email {
  return {
    id: "1",
    from: "Alice Example",
    email: "alice@example.com",
    subject: "Test subject",
    preview: "A preview",
    body: "Hello world",
    time: "10:00 AM",
    unread: true,
    starred: false,
    folder: "verified",
    avatarColor: "#6d28d9",
    ...overrides,
  };
}

describe("generateMockProofRecords", () => {
  it("produces deterministic records with all fields", () => {
    const email = makeEmail({});
    const records = generateMockProofRecords([email]);
    expect(records).toHaveLength(1);
    const record = records[0];

    expect(record.emailId).toBe("1");
    expect(record.messageHash).toBe(`0x${"1".repeat(16)}${"a".repeat(48)}d8c7e9`);
    expect(record.paymentHash).toBe(`0x${"1pay".repeat(12)}${"b".repeat(16)}f12a3d`);
    expect(record.diagnosticId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(record.contractAddress).toMatch(/^CB[A-Z0-9]{54}$/);
    expect(record.relayNode).toBe("relay-us-east-1.stealth.network");
    expect(record.latency).toBe(`${20 + ("Alice Example".length % 5) * 6}ms`);
    expect(record.signature).toMatch(/^Ed25519/);
    expect(record.postageAmount).toBe("10000000");
    expect(record.postageStatus).toBe("settled");
    expect(record.senderRule).toBe("default");
  });

  it("sets deliveredAt from time containing AM/PM", () => {
    const records = generateMockProofRecords([makeEmail({ time: "2:30 PM" })]);
    expect(records[0].deliveredAt).toBe("Today, 2:30 PM");
  });

  it("sets deliveredAt directly for relative times", () => {
    const records = generateMockProofRecords([makeEmail({ time: "Yesterday" })]);
    expect(records[0].deliveredAt).toBe("Yesterday");
  });

  it("sets readAt to null for unread emails", () => {
    const records = generateMockProofRecords([makeEmail({ unread: true })]);
    expect(records[0].readAt).toBeNull();
  });

  it("sets readAt for read emails", () => {
    const records = generateMockProofRecords([makeEmail({ unread: false })]);
    expect(records[0].readAt).toBe("Delivered + Read");
  });

  it("sets postageStatus to pending for requests folder", () => {
    const records = generateMockProofRecords([makeEmail({ folder: "requests" })]);
    expect(records[0].postageStatus).toBe("pending");
  });

  it("sets postageStatus to refunded for spam folder", () => {
    const records = generateMockProofRecords([makeEmail({ folder: "spam" })]);
    expect(records[0].postageStatus).toBe("refunded");
  });

  it("sets postageStatus to settled for other folders", () => {
    const records = generateMockProofRecords([makeEmail({ folder: "inbox" })]);
    expect(records[0].postageStatus).toBe("settled");
  });

  it("maps verify senderPolicy to default senderRule", () => {
    const records = generateMockProofRecords([makeEmail({ senderPolicy: "verify" })]);
    expect(records[0].senderRule).toBe("default");
  });

  it("maps allow senderPolicy directly", () => {
    const records = generateMockProofRecords([makeEmail({ senderPolicy: "allow" })]);
    expect(records[0].senderRule).toBe("allow");
  });

  it("maps block senderPolicy directly", () => {
    const records = generateMockProofRecords([makeEmail({ senderPolicy: "block" })]);
    expect(records[0].senderRule).toBe("block");
  });

  it("uses email's postageAmount when available", () => {
    const records = generateMockProofRecords([makeEmail({ postageAmount: "50000000" })]);
    expect(records[0].postageAmount).toBe("50000000");
  });

  it("generates deterministic output for the same input", () => {
    const email = makeEmail({});
    const a = generateMockProofRecords([email]);
    const b = generateMockProofRecords([email]);
    expect(a[0].messageHash).toBe(b[0].messageHash);
    expect(a[0].paymentHash).toBe(b[0].paymentHash);
    expect(a[0].diagnosticId).toBe(b[0].diagnosticId);
  });
});

describe("validateProofQuery", () => {
  it("returns null state for empty query", () => {
    expect(validateProofQuery("")).toEqual({ text: "", type: null });
  });

  it("recognises a valid G-address", () => {
    const addr = `G${"A".repeat(55)}`;
    const result = validateProofQuery(addr);
    expect(result.type).toBe("success");
    expect(result.text).toContain("Stellar address");
  });

  it("recognises a valid C-address", () => {
    const addr = `C${"B".repeat(55)}`;
    const result = validateProofQuery(addr);
    expect(result.type).toBe("success");
  });

  it("recognises a valid 64-char hex hash without prefix", () => {
    const hash = "a".repeat(64);
    const result = validateProofQuery(hash);
    expect(result.type).toBe("success");
    expect(result.text).toContain("hash");
  });

  it("recognises a valid 64-char hex hash with 0x prefix", () => {
    const hash = `0x${"b".repeat(64)}`;
    const result = validateProofQuery(hash);
    expect(result.type).toBe("success");
  });

  it("recognises a valid UUID", () => {
    const uuid = "d1f038c7-4b1d-44a6-8968-3e5f49230501";
    const result = validateProofQuery(uuid);
    expect(result.type).toBe("success");
    expect(result.text).toContain("diagnostic ID");
  });

  it("returns error for short G-address", () => {
    const short = "G" + "A".repeat(20);
    const result = validateProofQuery(short);
    expect(result.type).toBe("error");
    expect(result.text).toContain("Invalid address length");
  });

  it("returns error for short hex hash without prefix", () => {
    const short = "a".repeat(20);
    const result = validateProofQuery(short);
    expect(result.type).toBe("error");
    expect(result.text).toContain("Invalid hash length");
  });

  it("falls back to keyword warning for plain text", () => {
    const result = validateProofQuery("Alice");
    expect(result.type).toBe("warning");
    expect(result.text).toContain("keyword");
  });

  it("falls back to keyword warning for mixed-case name", () => {
    const result = validateProofQuery("Lina Park");
    expect(result.type).toBe("warning");
  });
});

describe("searchProofRecords", () => {
  const emails: Email[] = [
    makeEmail({
      id: "1",
      from: "Alice Example",
      email: "alice@example.com",
      subject: "Hello world",
    }),
    makeEmail({
      id: "2",
      from: "Bob Smith",
      email: "bob@test.com",
      subject: "Meeting notes",
    }),
  ];
  const records = generateMockProofRecords(emails);

  it("returns empty array for empty query", () => {
    expect(searchProofRecords(records, "")).toEqual([]);
    expect(searchProofRecords(records, "   ")).toEqual([]);
  });

  it("matches by sender name", () => {
    const result = searchProofRecords(records, "Alice");
    expect(result).toHaveLength(1);
    expect(result[0].emailId).toBe("1");
  });

  it("matches by email address", () => {
    const result = searchProofRecords(records, "bob@test.com");
    expect(result).toHaveLength(1);
    expect(result[0].emailId).toBe("2");
  });

  it("matches by subject", () => {
    const result = searchProofRecords(records, "Meeting");
    expect(result).toHaveLength(1);
  });

  it("matches by message hash", () => {
    const result = searchProofRecords(records, records[0].messageHash);
    expect(result).toHaveLength(1);
    expect(result[0].emailId).toBe("1");
  });

  it("matches by payment hash snippet", () => {
    const result = searchProofRecords(records, records[1].paymentHash.slice(2, 10));
    expect(result).toHaveLength(1);
    expect(result[0].emailId).toBe("2");
  });

  it("matches by diagnostic ID", () => {
    const result = searchProofRecords(records, records[0].diagnosticId);
    expect(result).toHaveLength(1);
    expect(result[0].emailId).toBe("1");
  });

  it("returns empty array when nothing matches", () => {
    const result = searchProofRecords(records, "zzzzznotfound");
    expect(result).toEqual([]);
  });

  it("is case-insensitive", () => {
    const result = searchProofRecords(records, "alice");
    expect(result).toHaveLength(1);
  });
});
