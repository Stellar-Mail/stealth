import { describe, it } from "node:test";
import assert from "node:assert";

import {
  sanitizeText,
  sanitizeSubject,
  validateEntryId,
  validateThreadId,
  validateTeamMemberId,
  validateEmailField,
  validateStatus,
  validateDateString,
  validateResponseTimeMs,
  validateDateRange,
  guardEntriesCount,
  guardMembersCount,
  validateEntryInput,
  RTTValidationError,
  LIMITS,
} from "../guards/response-time-guards.mjs";

const VALID_ENTRY = {
  id: "rsp-001",
  threadId: "thr-001",
  subject: "Q3 Budget Review",
  from: "alice@company.com",
  to: "team@company.com",
  sentAt: "2026-06-10T09:00:00Z",
  respondedAt: "2026-06-10T11:30:00Z",
  responseTimeMs: 9000000,
  teamMemberId: "mem-001",
  status: "met",
};

describe("Response Time Tracker — Guards", () => {
  describe("sanitizeText", () => {
    it("strips HTML tags", () => {
      assert.strictEqual(sanitizeText("<script>alert('xss')</script>hello"), "alert('xss')hello");
      assert.strictEqual(sanitizeText("<b>bold</b>"), "bold");
    });

    it("strips CR, LF, and null characters", () => {
      assert.strictEqual(sanitizeText("line1\r\nline2\0"), "line1  line2 ");
    });

    it("trims whitespace", () => {
      assert.strictEqual(sanitizeText("  hello  "), "hello");
    });

    it("returns empty string for non-string input", () => {
      assert.strictEqual(sanitizeText(undefined), "");
      assert.strictEqual(sanitizeText(null), "");
      assert.strictEqual(sanitizeText(123), "");
    });
  });

  describe("sanitizeSubject", () => {
    it("strips control characters", () => {
      assert.strictEqual(sanitizeSubject("hello\x00world"), "helloworld");
      assert.strictEqual(sanitizeSubject("line1\r\nline2"), "line1line2");
    });

    it("caps at max length", () => {
      const long = "a".repeat(LIMITS.MAX_SUBJECT_LENGTH + 100);
      const result = sanitizeSubject(long);
      assert.strictEqual(result.length, LIMITS.MAX_SUBJECT_LENGTH);
    });

    it("returns empty string for non-string input", () => {
      assert.strictEqual(sanitizeSubject(null), "");
      assert.strictEqual(sanitizeSubject(undefined), "");
    });
  });

  describe("validateEntryId", () => {
    it("accepts valid IDs", () => {
      assert.strictEqual(validateEntryId("rsp-001"), "rsp-001");
      assert.strictEqual(validateEntryId("abc_123"), "abc_123");
    });

    it("rejects empty string", () => {
      assert.throws(() => validateEntryId(""), RTTValidationError);
    });

    it("rejects non-string input", () => {
      assert.throws(() => validateEntryId(123), RTTValidationError);
      assert.throws(() => validateEntryId(null), RTTValidationError);
    });

    it("rejects oversized IDs", () => {
      const long = "a".repeat(LIMITS.MAX_ENTRY_ID_LENGTH + 1);
      assert.throws(() => validateEntryId(long), RTTValidationError);
    });

    it("rejects path-traversal characters", () => {
      assert.throws(() => validateEntryId("../../etc"), RTTValidationError);
      assert.throws(() => validateEntryId("a b"), RTTValidationError);
      assert.throws(() => validateEntryId("a.b"), RTTValidationError);
    });
  });

  describe("validateThreadId", () => {
    it("accepts valid thread IDs", () => {
      assert.strictEqual(validateThreadId("thr-001"), "thr-001");
    });

    it("rejects empty string", () => {
      assert.throws(() => validateThreadId(""), RTTValidationError);
    });

    it("rejects traversal chars", () => {
      assert.throws(() => validateThreadId("../../secret"), RTTValidationError);
    });
  });

  describe("validateTeamMemberId", () => {
    it("accepts valid member IDs", () => {
      assert.strictEqual(validateTeamMemberId("mem-001"), "mem-001");
    });

    it("rejects empty string", () => {
      assert.throws(() => validateTeamMemberId(""), RTTValidationError);
    });
  });

  describe("validateEmailField", () => {
    it("accepts valid email addresses", () => {
      assert.strictEqual(validateEmailField("alice@company.com"), "alice@company.com");
      assert.strictEqual(validateEmailField("a@b.co"), "a@b.co");
    });

    it("rejects empty string", () => {
      assert.throws(() => validateEmailField(""), RTTValidationError);
    });

    it("rejects strings without @", () => {
      assert.throws(() => validateEmailField("notanemail"), RTTValidationError);
    });

    it("rejects strings with only @ prefix", () => {
      assert.throws(() => validateEmailField("@domain.com"), RTTValidationError);
    });

    it("rejects strings with only @ suffix", () => {
      assert.throws(() => validateEmailField("user@"), RTTValidationError);
    });

    it("rejects control characters", () => {
      assert.throws(() => validateEmailField("user\r\n@domain.com"), RTTValidationError);
      assert.throws(() => validateEmailField("user\0@domain.com"), RTTValidationError);
    });

    it("rejects oversized emails", () => {
      const local = "a".repeat(255);
      const long = `${local}@b.com`;
      assert.throws(() => validateEmailField(long), RTTValidationError);
    });
  });

  describe("validateStatus", () => {
    it("accepts valid statuses", () => {
      assert.strictEqual(validateStatus("met"), "met");
      assert.strictEqual(validateStatus("missed"), "missed");
      assert.strictEqual(validateStatus("breached"), "breached");
    });

    it("rejects invalid statuses", () => {
      assert.throws(() => validateStatus("invalid"), RTTValidationError);
      assert.throws(() => validateStatus("MET"), RTTValidationError);
      assert.throws(() => validateStatus(""), RTTValidationError);
      assert.throws(() => validateStatus(undefined), RTTValidationError);
    });
  });

  describe("validateDateString", () => {
    it("accepts valid ISO dates", () => {
      assert.strictEqual(validateDateString("2026-06-10T09:00:00Z"), "2026-06-10T09:00:00Z");
      assert.strictEqual(validateDateString("2026-06-10"), "2026-06-10");
    });

    it("rejects malformed date strings", () => {
      assert.throws(() => validateDateString("not-a-date"), RTTValidationError);
      assert.throws(() => validateDateString(""), RTTValidationError);
      assert.throws(() => validateDateString(undefined), RTTValidationError);
    });
  });

  describe("validateResponseTimeMs", () => {
    it("accepts valid response times", () => {
      assert.strictEqual(validateResponseTimeMs(0), 0);
      assert.strictEqual(validateResponseTimeMs(9000000), 9000000);
      assert.strictEqual(validateResponseTimeMs(LIMITS.MAX_RESPONSE_TIME_MS), LIMITS.MAX_RESPONSE_TIME_MS);
    });

    it("rejects NaN", () => {
      assert.throws(() => validateResponseTimeMs(NaN), RTTValidationError);
    });

    it("rejects Infinity", () => {
      assert.throws(() => validateResponseTimeMs(Infinity), RTTValidationError);
    });

    it("rejects negative numbers", () => {
      assert.throws(() => validateResponseTimeMs(-1), RTTValidationError);
    });

    it("rejects oversized numbers", () => {
      assert.throws(
        () => validateResponseTimeMs(LIMITS.MAX_RESPONSE_TIME_MS + 1),
        RTTValidationError,
      );
    });

    it("rejects non-number input", () => {
      assert.throws(() => validateResponseTimeMs("1000"), RTTValidationError);
    });
  });

  describe("validateDateRange", () => {
    it("accepts a valid range", () => {
      const result = validateDateRange({ start: "2026-06-10", end: "2026-06-12" });
      assert.strictEqual(result.start, "2026-06-10");
      assert.strictEqual(result.end, "2026-06-12");
    });

    it("rejects non-object input", () => {
      assert.throws(() => validateDateRange(null), RTTValidationError);
      assert.throws(() => validateDateRange("string"), RTTValidationError);
    });

    it("rejects end before start", () => {
      assert.throws(
        () => validateDateRange({ start: "2026-06-12", end: "2026-06-10" }),
        RTTValidationError,
      );
    });

    it("rejects range exceeding max days", () => {
      const farStart = "2024-01-01";
      const farEnd = "2026-06-10";
      assert.throws(() => validateDateRange({ start: farStart, end: farEnd }), RTTValidationError);
    });

    it("accepts range at maximum span", () => {
      const result = validateDateRange({ start: "2025-06-24", end: "2026-06-24" });
      assert.strictEqual(result.start, "2025-06-24");
    });

    it("rejects malformed date strings inside range", () => {
      assert.throws(
        () => validateDateRange({ start: "bad-date", end: "2026-06-10" }),
        RTTValidationError,
      );
    });
  });

  describe("guardEntriesCount", () => {
    it("accepts arrays within limit", () => {
      assert.strictEqual(guardEntriesCount([1, 2, 3]), true);
    });

    it("rejects oversized arrays", () => {
      const big = new Array(LIMITS.MAX_ENTRIES_COUNT + 1);
      assert.throws(() => guardEntriesCount(big), RTTValidationError);
    });

    it("rejects non-array input", () => {
      assert.throws(() => guardEntriesCount(null), RTTValidationError);
      assert.throws(() => guardEntriesCount("string"), RTTValidationError);
    });
  });

  describe("guardMembersCount", () => {
    it("accepts arrays within limit", () => {
      assert.strictEqual(guardMembersCount([1, 2]), true);
    });

    it("rejects oversized arrays", () => {
      const big = new Array(LIMITS.MAX_MEMBERS_COUNT + 1);
      assert.throws(() => guardMembersCount(big), RTTValidationError);
    });

    it("rejects non-array input", () => {
      assert.throws(() => guardMembersCount(null), RTTValidationError);
    });
  });

  describe("validateEntryInput", () => {
    it("accepts a valid entry object", () => {
      assert.strictEqual(validateEntryInput(VALID_ENTRY), true);
    });

    it("rejects non-object input", () => {
      assert.throws(() => validateEntryInput(null), RTTValidationError);
      assert.throws(() => validateEntryInput("string"), RTTValidationError);
      assert.throws(() => validateEntryInput([]), RTTValidationError);
    });

    it("rejects entry with invalid status", () => {
      assert.throws(
        () => validateEntryInput({ ...VALID_ENTRY, status: "INVALID" }),
        RTTValidationError,
      );
    });

    it("rejects entry with negative response time", () => {
      assert.throws(
        () => validateEntryInput({ ...VALID_ENTRY, responseTimeMs: -100 }),
        RTTValidationError,
      );
    });

    it("rejects entry with malformed email", () => {
      assert.throws(
        () => validateEntryInput({ ...VALID_ENTRY, from: "not-an-email" }),
        RTTValidationError,
      );
    });

    it("rejects entry with traversal ID", () => {
      assert.throws(
        () => validateEntryInput({ ...VALID_ENTRY, id: "../../etc/passwd" }),
        RTTValidationError,
      );
    });
  });

  describe("fixture data passes all validations", () => {
    it("sample fixture entries pass validateEntryInput", async () => {
      const entries = JSON.parse(
        await import("fs").then((fs) =>
          fs.readFileSync(
            new URL("../fixtures/sample-response-times.json", import.meta.url),
            "utf-8",
          ),
        ),
      );
      for (const entry of entries) {
        assert.strictEqual(validateEntryInput(entry), true);
      }
    });
  });
});
