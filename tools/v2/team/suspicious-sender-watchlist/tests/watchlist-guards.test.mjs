/**
 * watchlist-guards.test.mjs — Suspicious Sender Watchlist
 *
 * Tests for the guard module (guards/watchlist-guards.mjs).
 * Runs under Node's built-in test runner (node --test).
 *
 * Covers:
 *   - sanitizeText
 *   - validateWatchlistId
 *   - validateSenderEmail
 *   - validateSenderName
 *   - validateReason
 *   - validateNotes
 *   - validateRiskLevel
 *   - validateEntryStatus
 *   - validateSearchQuery
 *   - guardWatchlistSize
 *   - validateAddEntryInput (composite)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Load the ESM module
import {
  sanitizeText,
  validateWatchlistId,
  validateSenderEmail,
  validateSenderName,
  validateReason,
  validateNotes,
  validateRiskLevel,
  validateEntryStatus,
  validateSearchQuery,
  guardWatchlistSize,
  validateAddEntryInput,
  WatchlistValidationError,
  LIMITS,
} from "../guards/watchlist-guards.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertThrows(fn, fieldPattern) {
  try {
    fn();
    assert.fail("Expected WatchlistValidationError to be thrown");
  } catch (e) {
    assert.ok(
      e instanceof WatchlistValidationError,
      `Expected WatchlistValidationError, got ${e.name}`,
    );
    if (fieldPattern) {
      assert.match(
        e.field,
        fieldPattern,
        `Expected field to match ${fieldPattern}, got ${e.field}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — sanitizeText", () => {
  it("returns empty string for non-string input", () => {
    assert.strictEqual(sanitizeText(null), "");
    assert.strictEqual(sanitizeText(undefined), "");
    assert.strictEqual(sanitizeText(42), "");
    assert.strictEqual(sanitizeText([]), "");
  });

  it("trims whitespace", () => {
    assert.strictEqual(sanitizeText("  hello  "), "hello");
  });

  it("strips HTML tags", () => {
    assert.strictEqual(sanitizeText("<script>alert(1)</script>"), "alert(1)");
    assert.strictEqual(sanitizeText("<b>bold</b>"), "bold");
    assert.strictEqual(sanitizeText("<img onerror=alert(1)>"), "");
    assert.strictEqual(sanitizeText('<a href="javascript:void(0)">click</a>'), "click");
  });

  it("replaces CRLF with space", () => {
    assert.strictEqual(sanitizeText("hello\r\nworld"), "hello  world");
    assert.strictEqual(sanitizeText("line1\rline2"), "line1 line2");
  });

  it("replaces null bytes with space", () => {
    assert.strictEqual(sanitizeText("hello\0world"), "hello world");
  });

  it("strips nested and malformed HTML", () => {
    assert.strictEqual(sanitizeText("<<script>alert</script>"), "alert");
  });

  it("preserves safe text", () => {
    const safe = "Hello, this is a normal text with numbers 123 and symbols !@#.";
    assert.strictEqual(sanitizeText(safe), safe);
  });
});

// ---------------------------------------------------------------------------
// validateWatchlistId
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateWatchlistId", () => {
  it("accepts valid IDs", () => {
    assert.strictEqual(validateWatchlistId("watch-001"), "watch-001");
    assert.strictEqual(validateWatchlistId("abc123"), "abc123");
    assert.strictEqual(validateWatchlistId("ABC_DEF-ghi"), "ABC_DEF-ghi");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateWatchlistId(""), /id/);
    assertThrows(() => validateWatchlistId(null), /id/);
    assertThrows(() => validateWatchlistId(undefined), /id/);
  });

  it("rejects path traversal sequences", () => {
    assertThrows(() => validateWatchlistId("../../../etc/passwd"), /id/);
    assertThrows(() => validateWatchlistId("..\\..\\..\\"), /id/);
  });

  it("rejects IDs with whitespace", () => {
    assertThrows(() => validateWatchlistId("watch 001"), /id/);
    assertThrows(() => validateWatchlistId("watch\t001"), /id/);
  });

  it("rejects IDs with HTML injection", () => {
    assertThrows(() => validateWatchlistId("<script>alert(1)</script>"), /id/);
  });

  it("rejects IDs exceeding max length", () => {
    const longId = "a".repeat(LIMITS.MAX_ID_LENGTH + 1);
    assertThrows(() => validateWatchlistId(longId), /id/);
  });

  it("accepts IDs exactly at max length", () => {
    const exact = "a".repeat(LIMITS.MAX_ID_LENGTH);
    assert.strictEqual(validateWatchlistId(exact), exact);
  });
});

// ---------------------------------------------------------------------------
// validateSenderEmail
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateSenderEmail", () => {
  it("accepts valid email addresses", () => {
    assert.strictEqual(validateSenderEmail("user@example.com"), "user@example.com");
    assert.strictEqual(
      validateSenderEmail("test.user+tag@sub.domain.co.uk"),
      "test.user+tag@sub.domain.co.uk",
    );
    assert.strictEqual(validateSenderEmail("a@b.io"), "a@b.io");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateSenderEmail(""), /senderEmail/);
    assertThrows(() => validateSenderEmail(null), /senderEmail/);
    assertThrows(() => validateSenderEmail(undefined), /senderEmail/);
  });

  it("rejects CRLF header injection", () => {
    assertThrows(
      () => validateSenderEmail("user@evil.test\r\nBcc: victim@test.com"),
      /senderEmail/,
    );
    assertThrows(() => validateSenderEmail("user@evil.test\nBcc: victim"), /senderEmail/);
  });

  it("rejects null byte injection", () => {
    assertThrows(() => validateSenderEmail("user\0@evil.test"), /senderEmail/);
  });

  it("rejects malformed email structure", () => {
    assertThrows(() => validateSenderEmail("@domain.test"), /senderEmail/);
    assertThrows(() => validateSenderEmail("user@"), /senderEmail/);
    assertThrows(() => validateSenderEmail("noatsign"), /senderEmail/);
    assertThrows(() => validateSenderEmail("@"), /senderEmail/);
  });

  it("rejects emails exceeding max length", () => {
    const local = "a".repeat(LIMITS.MAX_EMAIL_LENGTH - 4);
    const longEmail = `${local}@b.co`;
    assertThrows(() => validateSenderEmail(longEmail), /senderEmail/);
  });
});

// ---------------------------------------------------------------------------
// validateSenderName
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateSenderName", () => {
  it("accepts valid names", () => {
    assert.strictEqual(validateSenderName("John Doe"), "John Doe");
    assert.strictEqual(validateSenderName("Alice"), "Alice");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateSenderName(""), /senderName/);
    assertThrows(() => validateSenderName("   "), /senderName/);
    assertThrows(() => validateSenderName(null), /senderName/);
    assertThrows(() => validateSenderName(undefined), /senderName/);
  });

  it("strips HTML tags", () => {
    assert.strictEqual(validateSenderName("<script>alert(1)</script>"), "alert(1)");
  });

  it("strips control characters", () => {
    assert.strictEqual(validateSenderName("John\r\nDoe"), "John  Doe");
  });

  it("rejects names exceeding max length", () => {
    const longName = "a".repeat(LIMITS.MAX_NAME_LENGTH + 1);
    assertThrows(() => validateSenderName(longName), /senderName/);
  });

  it("trims whitespace from valid names", () => {
    assert.strictEqual(validateSenderName("  John Doe  "), "John Doe");
  });
});

// ---------------------------------------------------------------------------
// validateReason
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateReason", () => {
  it("accepts valid reasons", () => {
    assert.strictEqual(validateReason("Known phishing domain"), "Known phishing domain");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateReason(""), /reason/);
    assertThrows(() => validateReason("   "), /reason/);
    assertThrows(() => validateReason(null), /reason/);
    assertThrows(() => validateReason(undefined), /reason/);
  });

  it("strips HTML tags from reason", () => {
    assert.strictEqual(
      validateReason("<b>Phishing</b> <script>attack</script>"),
      "Phishing attack",
    );
  });

  it("strips control characters", () => {
    assert.strictEqual(validateReason("Fraudulent\rinvoice\0sender"), "Fraudulent invoice sender");
  });

  it("rejects reasons exceeding max length", () => {
    const longReason = "a".repeat(LIMITS.MAX_REASON_LENGTH + 1);
    assertThrows(() => validateReason(longReason), /reason/);
  });
});

// ---------------------------------------------------------------------------
// validateNotes
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateNotes", () => {
  it("returns empty string for undefined/null notes", () => {
    assert.strictEqual(validateNotes(undefined), "");
    assert.strictEqual(validateNotes(null), "");
  });

  it("accepts valid notes", () => {
    assert.strictEqual(validateNotes("Flagged by 3 team members"), "Flagged by 3 team members");
  });

  it("rejects non-string notes", () => {
    assertThrows(() => validateNotes(42), /notes/);
    assertThrows(() => validateNotes([]), /notes/);
    assertThrows(() => validateNotes({}), /notes/);
  });

  it("strips HTML tags from notes", () => {
    assert.strictEqual(
      validateNotes("Keep an <script>eye</script> on this"),
      "Keep an eye on this",
    );
  });

  it("rejects notes exceeding max length", () => {
    const longNotes = "a".repeat(LIMITS.MAX_NOTES_LENGTH + 1);
    assertThrows(() => validateNotes(longNotes), /notes/);
  });
});

// ---------------------------------------------------------------------------
// validateRiskLevel
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateRiskLevel", () => {
  it("accepts valid risk levels (case-insensitive)", () => {
    assert.strictEqual(validateRiskLevel("low"), "low");
    assert.strictEqual(validateRiskLevel("medium"), "medium");
    assert.strictEqual(validateRiskLevel("high"), "high");
    assert.strictEqual(validateRiskLevel("LOW"), "low");
    assert.strictEqual(validateRiskLevel("Medium"), "medium");
    assert.strictEqual(validateRiskLevel("HIGH"), "high");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateRiskLevel(""), /riskLevel/);
    assertThrows(() => validateRiskLevel(null), /riskLevel/);
    assertThrows(() => validateRiskLevel(undefined), /riskLevel/);
  });

  it("rejects invalid risk levels", () => {
    assertThrows(() => validateRiskLevel("critical"), /riskLevel/);
    assertThrows(() => validateRiskLevel("CRITICAL"), /riskLevel/);
    assertThrows(() => validateRiskLevel("very high"), /riskLevel/);
    assertThrows(() => validateRiskLevel("none"), /riskLevel/);
  });
});

// ---------------------------------------------------------------------------
// validateEntryStatus
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateEntryStatus", () => {
  it("accepts valid statuses (case-insensitive)", () => {
    assert.strictEqual(validateEntryStatus("active"), "active");
    assert.strictEqual(validateEntryStatus("dismissed"), "dismissed");
    assert.strictEqual(validateEntryStatus("ACTIVE"), "active");
    assert.strictEqual(validateEntryStatus("Dismissed"), "dismissed");
  });

  it("rejects empty or non-string", () => {
    assertThrows(() => validateEntryStatus(""), /status/);
    assertThrows(() => validateEntryStatus(null), /status/);
    assertThrows(() => validateEntryStatus(undefined), /status/);
  });

  it("rejects invalid statuses", () => {
    assertThrows(() => validateEntryStatus("deleted"), /status/);
    assertThrows(() => validateEntryStatus("pending"), /status/);
    assertThrows(() => validateEntryStatus("archived"), /status/);
  });
});

// ---------------------------------------------------------------------------
// validateSearchQuery
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateSearchQuery", () => {
  it("returns empty string for undefined/null", () => {
    assert.strictEqual(validateSearchQuery(undefined), "");
    assert.strictEqual(validateSearchQuery(null), "");
  });

  it("accepts valid queries", () => {
    assert.strictEqual(validateSearchQuery("phishing"), "phishing");
    assert.strictEqual(validateSearchQuery("  invoice  "), "invoice");
  });

  it("rejects non-string queries", () => {
    assertThrows(() => validateSearchQuery(42), /search/);
    assertThrows(() => validateSearchQuery([]), /search/);
    assertThrows(() => validateSearchQuery({}), /search/);
  });

  it("rejects queries exceeding max length", () => {
    const longQuery = "a".repeat(LIMITS.MAX_SEARCH_LENGTH + 1);
    assertThrows(() => validateSearchQuery(longQuery), /search/);
  });

  it("accepts queries exactly at max length", () => {
    const exact = "a".repeat(LIMITS.MAX_SEARCH_LENGTH);
    assert.strictEqual(validateSearchQuery(exact), exact);
  });
});

// ---------------------------------------------------------------------------
// guardWatchlistSize
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — guardWatchlistSize", () => {
  it("passes for empty array", () => {
    assert.strictEqual(guardWatchlistSize([]), true);
  });

  it("passes for array under limit", () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ id: `e-${i}` }));
    assert.strictEqual(guardWatchlistSize(entries), true);
  });

  it("rejects array exactly at limit (guard uses >= semantics)", () => {
    const entries = Array.from({ length: LIMITS.MAX_WATCHLIST_ENTRIES }, (_, i) => ({
      id: `e-${i}`,
    }));
    assertThrows(() => guardWatchlistSize(entries), /entries/);
  });

  it("passes for array one below limit", () => {
    const entries = Array.from({ length: LIMITS.MAX_WATCHLIST_ENTRIES - 1 }, (_, i) => ({
      id: `e-${i}`,
    }));
    assert.strictEqual(guardWatchlistSize(entries), true);
  });

  it("rejects array exceeding limit", () => {
    const entries = Array.from({ length: LIMITS.MAX_WATCHLIST_ENTRIES + 1 }, (_, i) => ({
      id: `e-${i}`,
    }));
    assertThrows(() => guardWatchlistSize(entries), /entries/);
  });

  it("rejects non-array input", () => {
    assertThrows(() => guardWatchlistSize(null), /entries/);
    assertThrows(() => guardWatchlistSize(undefined), /entries/);
    assertThrows(() => guardWatchlistSize("not-an-array"), /entries/);
    assertThrows(() => guardWatchlistSize({}), /entries/);
  });

  it("error message includes safe limit and pagination hint", () => {
    const oversized = Array.from({ length: LIMITS.MAX_WATCHLIST_ENTRIES + 1 }, (_, i) => ({
      id: `e-${i}`,
    }));
    try {
      guardWatchlistSize(oversized);
      assert.fail("Expected WatchlistValidationError");
    } catch (e) {
      assert.ok(
        e.message.includes("paginate"),
        `Expected pagination hint in message, got: ${e.message}`,
      );
      assert.ok(
        e.message.includes(String(LIMITS.MAX_WATCHLIST_ENTRIES)),
        `Expected limit in message, got: ${e.message}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// validateAddEntryInput (composite)
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — validateAddEntryInput", () => {
  it("accepts well-formed input", () => {
    const result = validateAddEntryInput({
      senderEmail: "user@example.com",
      senderName: "John Doe",
      reason: "Known phishing domain",
      riskLevel: "high",
    });
    assert.strictEqual(result.senderEmail, "user@example.com");
    assert.strictEqual(result.senderName, "John Doe");
    assert.strictEqual(result.reason, "Known phishing domain");
    assert.strictEqual(result.riskLevel, "high");
    assert.strictEqual(result.notes, "");
  });

  it("accepts input with notes", () => {
    const result = validateAddEntryInput({
      senderEmail: "spam@example.com",
      senderName: "Spammer",
      reason: "Spam",
      riskLevel: "low",
      notes: "Reported by IT team",
    });
    assert.strictEqual(result.notes, "Reported by IT team");
  });

  it("sanitizes text fields", () => {
    const result = validateAddEntryInput({
      senderEmail: "user@example.com",
      senderName: "<b>Hacker</b>",
      reason: "<script>malicious</script>",
      riskLevel: "high",
    });
    assert.strictEqual(result.senderName, "Hacker");
    assert.strictEqual(result.reason, "malicious");
  });

  it("rejects non-object input", () => {
    assertThrows(() => validateAddEntryInput(null), /input/);
    assertThrows(() => validateAddEntryInput("string"), /input/);
    assertThrows(() => validateAddEntryInput(42), /input/);
    assertThrows(() => validateAddEntryInput([]), /input/);
  });

  it("rejects input with invalid email", () => {
    assertThrows(
      () =>
        validateAddEntryInput({
          senderEmail: "invalid",
          senderName: "Test",
          reason: "Test",
          riskLevel: "low",
        }),
      /senderEmail/,
    );
  });

  it("rejects input with invalid risk level", () => {
    assertThrows(
      () =>
        validateAddEntryInput({
          senderEmail: "user@example.com",
          senderName: "Test",
          reason: "Test",
          riskLevel: "critical",
        }),
      /riskLevel/,
    );
  });

  it("rejects input with empty name", () => {
    assertThrows(
      () =>
        validateAddEntryInput({
          senderEmail: "user@example.com",
          senderName: "",
          reason: "Test",
          riskLevel: "low",
        }),
      /senderName/,
    );
  });

  it("rejects input with empty reason", () => {
    assertThrows(
      () =>
        validateAddEntryInput({
          senderEmail: "user@example.com",
          senderName: "Test",
          reason: "",
          riskLevel: "low",
        }),
      /reason/,
    );
  });

  it("converts risk level to lowercase", () => {
    const result = validateAddEntryInput({
      senderEmail: "user@example.com",
      senderName: "Test",
      reason: "Test",
      riskLevel: "HIGH",
    });
    assert.strictEqual(result.riskLevel, "high");
  });
});

// ---------------------------------------------------------------------------
// LIMITS export
// ---------------------------------------------------------------------------

describe("Suspicious Sender Watchlist — LIMITS", () => {
  it("has all expected limit constants", () => {
    assert.ok(LIMITS.MAX_WATCHLIST_ENTRIES > 0);
    assert.ok(LIMITS.MAX_ID_LENGTH > 0);
    assert.ok(LIMITS.MAX_EMAIL_LENGTH > 0);
    assert.ok(LIMITS.MAX_NAME_LENGTH > 0);
    assert.ok(LIMITS.MAX_REASON_LENGTH > 0);
    assert.ok(LIMITS.MAX_NOTES_LENGTH > 0);
    assert.ok(LIMITS.MAX_SEARCH_LENGTH > 0);
    assert.ok(Array.isArray(LIMITS.ALLOWED_RISK_LEVELS));
    assert.ok(Array.isArray(LIMITS.ALLOWED_ENTRY_STATUSES));
  });

  it("has 3 allowed risk levels", () => {
    assert.deepStrictEqual(LIMITS.ALLOWED_RISK_LEVELS, ["low", "medium", "high"]);
  });

  it("has 2 allowed entry statuses", () => {
    assert.deepStrictEqual(LIMITS.ALLOWED_ENTRY_STATUSES, ["active", "dismissed"]);
  });
});
