import { describe, expect, it } from "vitest";
import {
  truncateHash,
  formatLatency,
  formatPostageStatus,
  isValidMockHash,
  isValidDiagnosticId,
  formatProofSummary,
  validateProofRecord,
} from "../proofFormatting";
import { demoProofRecords } from "../fixtures/proofRecordFixtures";
import type { ProofRecord } from "../types/proofRecord";

describe("truncateHash", () => {
  it("truncates standard hex hash with default prefix/suffix lengths", () => {
    const hash = "0xabcdef1234567890abcdef1234567890abcdef";
    expect(truncateHash(hash)).toBe("0xabcdef\u2026cdef");
  });

  it("handles hashes without 0x prefix by adding it in the result", () => {
    const hash = "abcdef1234567890abcdef1234567890abcdef";
    expect(truncateHash(hash)).toBe("0xabcdef\u2026cdef");
  });

  it("returns original hash if body length is less than or equal to prefix + suffix", () => {
    const shortHash = "0x123456";
    expect(truncateHash(shortHash, 4, 4)).toBe("0x123456");
  });

  it("supports custom prefix and suffix lengths", () => {
    const hash = "0xabcdef1234567890";
    expect(truncateHash(hash, 4, 2)).toBe("0xabcd\u202690");
  });
});

describe("formatLatency", () => {
  it("normalises latency strings to lowercase and trims whitespace", () => {
    expect(formatLatency("  42MS  ")).toBe("42ms");
    expect(formatLatency("15ms")).toBe("15ms");
  });
});

describe("formatPostageStatus", () => {
  it("returns human-readable labels for each postage status", () => {
    expect(formatPostageStatus("pending")).toBe("Pending");
    expect(formatPostageStatus("settled")).toBe("Settled");
    expect(formatPostageStatus("refunded")).toBe("Refunded");
  });
});

describe("isValidMockHash", () => {
  it("returns true for valid hex strings starting with 0x", () => {
    expect(isValidMockHash("0x1234567890abcdef")).toBe(true);
    expect(isValidMockHash("0xABCDEF")).toBe(true);
    expect(isValidMockHash(" 0x12ab  ")).toBe(true); // trims whitespace
  });

  it("returns false for non-hex, empty, or missing 0x prefix", () => {
    expect(isValidMockHash("1234567890abcdef")).toBe(false);
    expect(isValidMockHash("0x123g")).toBe(false);
    expect(isValidMockHash("")).toBe(false);
  });
});

describe("isValidDiagnosticId", () => {
  it("returns true for valid UUID format", () => {
    expect(isValidDiagnosticId("12345678-abcd-1234-abcd-1234567890ab")).toBe(true);
    expect(isValidDiagnosticId(" 12345678-abcd-1234-abcd-1234567890ab ")).toBe(true); // trims
  });

  it("returns false for invalid UUID formatting", () => {
    expect(isValidDiagnosticId("12345678-abcd-1234-abcd")).toBe(false);
    expect(isValidDiagnosticId("invalid-uuid-string")).toBe(false);
    expect(isValidDiagnosticId("")).toBe(false);
  });
});

describe("formatProofSummary", () => {
  it("builds a formatted one-line summary", () => {
    const record: ProofRecord = demoProofRecords[0];
    const summary = formatProofSummary(record);
    // msg=0xabc…1234 | pay=0xdef…5678 | settled | 42ms
    expect(summary).toContain("msg=");
    expect(summary).toContain("pay=");
    expect(summary).toContain("Settled");
    expect(summary).toContain("42ms");
  });
});

describe("validateProofRecord", () => {
  it("returns empty array for valid proof record fixture", () => {
    const errors = validateProofRecord(demoProofRecords[0]);
    expect(errors).toEqual([]);
  });

  it("identifies invalid messageHash path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      messageHash: "invalid_hash",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "messageHash",
      message: "Must be a hex string starting with 0x.",
    });
  });

  it("identifies invalid paymentHash path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      paymentHash: "invalid_hash",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "paymentHash",
      message: "Must be a hex string starting with 0x.",
    });
  });

  it("identifies invalid diagnosticId path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      diagnosticId: "not-a-uuid",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "diagnosticId",
      message: "Must be a valid UUID (8-4-4-4-12).",
    });
  });

  it("identifies missing/invalid contractAddress path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      contractAddress: "short",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "contractAddress",
      message: "Contract address is required.",
    });
  });

  it("identifies missing signature path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      signature: "  ",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "signature",
      message: "Signature is required.",
    });
  });

  it("identifies invalid latency path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      latency: "42",
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "latency",
      message: 'Latency must be in the format "42ms".',
    });
  });

  it("identifies invalid postageStatus path", () => {
    const invalidRecord: Partial<ProofRecord> = {
      ...demoProofRecords[0],
      postageStatus: "unknown-status" as any,
    };
    const errors = validateProofRecord(invalidRecord);
    expect(errors).toContainEqual({
      field: "postageStatus",
      message: "Must be pending, settled, or refunded.",
    });
  });
});
