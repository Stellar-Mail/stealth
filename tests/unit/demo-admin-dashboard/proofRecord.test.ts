import { describe, expect, it } from "vitest";
import {
  mockDiagnosticId,
  mockMessageHash,
  mockPaymentHash,
  mockSignature,
} from "../../../src/features/demo-admin-dashboard/mockHashHelpers";
import {
  formatLatency,
  formatPostageStatus,
  formatProofSummary,
  isValidDiagnosticId,
  isValidMockHash,
  POSTAGE_STATUS_LABEL,
  truncateHash,
  validateProofRecord,
} from "../../../src/features/demo-admin-dashboard/proofFormatting";
import { demoProofRecords } from "../../../src/features/demo-admin-dashboard/fixtures/proofRecordFixtures";

// ─── mockHashHelpers ──────────────────────────────────────────────────────────

describe("mockHashHelpers", () => {
  describe("mockMessageHash", () => {
    it("returns a 0x-prefixed 64-char hex string", () => {
      const hash = mockMessageHash("msg-001");
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("is deterministic for the same input", () => {
      expect(mockMessageHash("msg-abc")).toBe(mockMessageHash("msg-abc"));
    });

    it("produces different values for different inputs", () => {
      expect(mockMessageHash("msg-001")).not.toBe(mockMessageHash("msg-002"));
    });
  });

  describe("mockPaymentHash", () => {
    it("returns a 0x-prefixed 64-char hex string", () => {
      expect(mockPaymentHash("pay-001")).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("differs from the message hash for the same key", () => {
      expect(mockPaymentHash("x")).not.toBe(mockMessageHash("x"));
    });
  });

  describe("mockDiagnosticId", () => {
    it("returns a UUID-shaped string (8-4-4-4-12)", () => {
      expect(mockDiagnosticId("trace-001")).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("is deterministic", () => {
      expect(mockDiagnosticId("k")).toBe(mockDiagnosticId("k"));
    });
  });

  describe("mockSignature", () => {
    it("starts with 'Ed25519 ['", () => {
      expect(mockSignature("msg-001")).toMatch(/^Ed25519 \[0x[0-9a-f]+\]$/);
    });

    it("is deterministic", () => {
      expect(mockSignature("s")).toBe(mockSignature("s"));
    });
  });
});

// ─── proofFormatting ─────────────────────────────────────────────────────────

describe("proofFormatting", () => {
  describe("POSTAGE_STATUS_LABEL", () => {
    it("maps every status to a non-empty label", () => {
      for (const [, label] of Object.entries(POSTAGE_STATUS_LABEL)) {
        expect(label.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe("truncateHash", () => {
    it("leaves short hashes unchanged", () => {
      expect(truncateHash("0xabcd1234", 6, 4)).toBe("0xabcd1234");
    });

    it("truncates long hashes with ellipsis", () => {
      const hash = "0x" + "a".repeat(64);
      const result = truncateHash(hash);
      expect(result).toContain("…");
      expect(result.startsWith("0x")).toBe(true);
    });
  });

  describe("formatLatency", () => {
    it("lowercases and trims the value", () => {
      expect(formatLatency("  42MS  ")).toBe("42ms");
    });
  });

  describe("formatPostageStatus", () => {
    it("returns 'Settled' for settled", () => {
      expect(formatPostageStatus("settled")).toBe("Settled");
    });
    it("returns 'Pending' for pending", () => {
      expect(formatPostageStatus("pending")).toBe("Pending");
    });
    it("returns 'Refunded' for refunded", () => {
      expect(formatPostageStatus("refunded")).toBe("Refunded");
    });
  });

  describe("isValidMockHash", () => {
    it("accepts valid 0x hex strings", () => {
      expect(isValidMockHash("0xabcdef1234567890")).toBe(true);
    });
    it("rejects non-hex strings", () => {
      expect(isValidMockHash("not-a-hash")).toBe(false);
    });
    it("rejects strings without 0x prefix", () => {
      expect(isValidMockHash("abcdef1234")).toBe(false);
    });
  });

  describe("isValidDiagnosticId", () => {
    it("accepts a valid UUID", () => {
      expect(isValidDiagnosticId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(true);
    });
    it("rejects invalid strings", () => {
      expect(isValidDiagnosticId("not-a-uuid")).toBe(false);
    });
  });

  describe("formatProofSummary", () => {
    it("returns a pipe-delimited summary string", () => {
      const summary = formatProofSummary({
        messageHash: "0xabc1234567890123",
        paymentHash: "0xdef9876543210123",
        postageStatus: "settled",
        latency: "42ms",
      });
      expect(summary).toContain("msg=");
      expect(summary).toContain("pay=");
      expect(summary).toContain("Settled");
      expect(summary).toContain("42ms");
    });
  });

  describe("validateProofRecord", () => {
    it("returns no errors for a valid record", () => {
      const errors = validateProofRecord({
        messageHash: mockMessageHash("msg-001"),
        paymentHash: mockPaymentHash("pay-001"),
        contractAddress: "CDEMO1SOROBANCONTRACT1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
        diagnosticId: mockDiagnosticId("trace-001"),
        latency: "42ms",
        signature: mockSignature("msg-001"),
        postageStatus: "settled",
      });
      expect(errors).toHaveLength(0);
    });

    it("returns errors for an empty object", () => {
      const errors = validateProofRecord({});
      expect(errors.length).toBeGreaterThan(0);
    });

    it("flags an invalid messageHash", () => {
      const errors = validateProofRecord({
        messageHash: "not-a-hash",
        paymentHash: mockPaymentHash("pay-001"),
        contractAddress: "CDEMO1SOROBANCONTRACT1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
        diagnosticId: mockDiagnosticId("trace-001"),
        latency: "42ms",
        signature: mockSignature("msg-001"),
        postageStatus: "settled",
      });
      const fieldNames = errors.map((e) => e.field);
      expect(fieldNames).toContain("messageHash");
    });

    it("flags an invalid diagnosticId", () => {
      const errors = validateProofRecord({
        messageHash: mockMessageHash("msg-001"),
        paymentHash: mockPaymentHash("pay-001"),
        contractAddress: "CDEMO1SOROBANCONTRACT1ABCDEFGHIJKLMNOPQRSTUVWXYZ1234",
        diagnosticId: "bad-id",
        latency: "42ms",
        signature: mockSignature("msg-001"),
        postageStatus: "settled",
      });
      expect(errors.map((e) => e.field)).toContain("diagnosticId");
    });
  });
});

// ─── proofRecordFixtures ──────────────────────────────────────────────────────

describe("demoProofRecords", () => {
  it("exports three deterministic proof records", () => {
    expect(demoProofRecords).toHaveLength(3);
  });

  it("each record has the required fields", () => {
    for (const r of demoProofRecords) {
      expect(r.id.trim()).not.toBe("");
      expect(r.messageHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(r.paymentHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(r.contractAddress.trim().length).toBeGreaterThan(0);
      expect(r.diagnosticId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(r.latency).toMatch(/^\d+ms$/);
      expect(r.signature).toMatch(/^Ed25519 \[0x/);
      expect(["pending", "settled", "refunded"]).toContain(r.postageStatus);
    }
  });

  it("IDs are unique", () => {
    const ids = demoProofRecords.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("records are deterministic (stable across calls)", () => {
    // Importing again resolves the same module, so fixture values are stable.
    expect(demoProofRecords[0].messageHash).toBe(mockMessageHash("msg-001"));
    expect(demoProofRecords[1].postageStatus).toBe("pending");
    expect(demoProofRecords[2].postageStatus).toBe("refunded");
  });
});
