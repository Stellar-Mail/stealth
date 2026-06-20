import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import {
  ReviewValidationError,
  validateReviewId,
  validateStatus,
  validatePriority,
  validateSubmitterEmail,
  sanitizeNote,
  sanitizeSubject,
  validateReviewRequest,
  guardQueueSize,
  guardHistorySize,
  guardAttachmentCount,
  guardTags,
  LIMITS,
} from "../guards/review-guards.mjs";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "sample-review-requests.json"), "utf-8"),
);

// ---------------------------------------------------------------------------
// validateReviewId
// ---------------------------------------------------------------------------

describe("validateReviewId", () => {
  it("accepts alphanumeric IDs with - and _", () => {
    assert.equal(validateReviewId("review-2026-001"), "review-2026-001");
    assert.equal(validateReviewId("REVIEW_URGENT_42"), "REVIEW_URGENT_42");
  });

  it("throws for empty string", () => {
    assert.throws(() => validateReviewId(""), ReviewValidationError);
  });

  it("throws for non-string", () => {
    assert.throws(() => validateReviewId(null), ReviewValidationError);
    assert.throws(() => validateReviewId(123), ReviewValidationError);
  });

  it("throws for path traversal", () => {
    assert.throws(() => validateReviewId("../../etc/passwd"), ReviewValidationError);
  });

  it("throws for XSS payload", () => {
    assert.throws(() => validateReviewId("<script>alert(1)</script>"), ReviewValidationError);
  });

  it("throws for SQL injection attempt", () => {
    assert.throws(() => validateReviewId("review; DROP TABLE reviews--"), ReviewValidationError);
  });

  it("throws for oversized ID", () => {
    assert.throws(
      () => validateReviewId("a".repeat(LIMITS.MAX_REVIEW_ID_LENGTH + 1)),
      ReviewValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// validateStatus
// ---------------------------------------------------------------------------

describe("validateStatus", () => {
  it("accepts all allowed statuses", () => {
    for (const s of ["pending", "approved", "rejected", "escalated"]) {
      assert.equal(validateStatus(s), s);
    }
  });

  it("throws for unknown status", () => {
    assert.throws(() => validateStatus("superApproved"), ReviewValidationError);
  });

  it("throws for wrong case", () => {
    assert.throws(() => validateStatus("PENDING"), ReviewValidationError);
  });

  it("throws for empty string", () => {
    assert.throws(() => validateStatus(""), ReviewValidationError);
  });
});

// ---------------------------------------------------------------------------
// validatePriority
// ---------------------------------------------------------------------------

describe("validatePriority", () => {
  it("accepts all allowed priorities", () => {
    for (const p of ["low", "medium", "high", "critical"]) {
      assert.equal(validatePriority(p), p);
    }
  });

  it("throws for unknown priority", () => {
    assert.throws(() => validatePriority("urgent"), ReviewValidationError);
  });

  it("throws for wrong case", () => {
    assert.throws(() => validatePriority("CRITICAL"), ReviewValidationError);
  });
});

// ---------------------------------------------------------------------------
// validateSubmitterEmail
// ---------------------------------------------------------------------------

describe("validateSubmitterEmail", () => {
  it("accepts well-formed email addresses", () => {
    assert.equal(validateSubmitterEmail("alice@example.test"), "alice@example.test");
    assert.equal(
      validateSubmitterEmail("bob.smith+reviews@company.test"),
      "bob.smith+reviews@company.test",
    );
  });

  it("throws for CRLF header injection", () => {
    assert.throws(
      () => validateSubmitterEmail("user@evil.test\r\nBcc: victim@example.test"),
      ReviewValidationError,
    );
    assert.throws(
      () => validateSubmitterEmail("user@evil.test\nX-Injected: yes"),
      ReviewValidationError,
    );
  });

  it("throws for null byte", () => {
    assert.throws(() => validateSubmitterEmail("user\0@evil.test"), ReviewValidationError);
  });

  it("throws for missing local part", () => {
    assert.throws(() => validateSubmitterEmail("@nodomain"), ReviewValidationError);
  });

  it("throws for missing domain", () => {
    assert.throws(() => validateSubmitterEmail("user@"), ReviewValidationError);
  });

  it("throws for empty string", () => {
    assert.throws(() => validateSubmitterEmail(""), ReviewValidationError);
  });

  it("throws for oversized email", () => {
    assert.throws(() => validateSubmitterEmail("a".repeat(250) + "@x.test"), ReviewValidationError);
  });
});

// ---------------------------------------------------------------------------
// sanitizeNote
// ---------------------------------------------------------------------------

describe("sanitizeNote", () => {
  it("returns the note unchanged when it is clean", () => {
    assert.equal(sanitizeNote("Normal review note."), "Normal review note.");
  });

  it("strips control characters but preserves tab and newline", () => {
    const out = sanitizeNote("line1\nline2\ttab\x00null\x1Funit");
    assert.ok(!out.includes("\x00"));
    assert.ok(!out.includes("\x1F"));
    assert.ok(out.includes("\n"));
    assert.ok(out.includes("\t"));
  });

  it("trims leading and trailing whitespace", () => {
    assert.equal(sanitizeNote("  hello  "), "hello");
  });

  it("returns empty string for whitespace-only input", () => {
    assert.equal(sanitizeNote("   \t  "), "");
  });

  it("truncates notes that exceed MAX_NOTE_LENGTH", () => {
    const long = "x".repeat(LIMITS.MAX_NOTE_LENGTH + 100);
    const out = sanitizeNote(long);
    assert.equal(out.length, LIMITS.MAX_NOTE_LENGTH);
  });

  it("returns empty string for non-string input", () => {
    assert.equal(sanitizeNote(null), "");
    assert.equal(sanitizeNote(42), "");
  });
});

// ---------------------------------------------------------------------------
// sanitizeSubject
// ---------------------------------------------------------------------------

describe("sanitizeSubject", () => {
  it("returns the subject unchanged when it is clean", () => {
    assert.equal(sanitizeSubject("Q2 Expense Report Review"), "Q2 Expense Report Review");
  });

  it("strips CRLF injection characters", () => {
    const out = sanitizeSubject("Subject\r\nX-Injected: yes");
    assert.ok(!out.includes("\r"));
    assert.ok(!out.includes("\n"));
  });

  it("strips null bytes", () => {
    assert.ok(!sanitizeSubject("Sub\0ject").includes("\0"));
  });

  it("truncates subjects exceeding MAX_SUBJECT_LENGTH", () => {
    const long = "s".repeat(LIMITS.MAX_SUBJECT_LENGTH + 50);
    assert.equal(sanitizeSubject(long).length, LIMITS.MAX_SUBJECT_LENGTH);
  });

  it("returns empty string for non-string input", () => {
    assert.equal(sanitizeSubject(undefined), "");
  });
});

// ---------------------------------------------------------------------------
// validateReviewRequest
// ---------------------------------------------------------------------------

describe("validateReviewRequest", () => {
  it("passes a well-formed request object", () => {
    assert.equal(
      validateReviewRequest({
        reviewId: "review-001",
        status: "pending",
        priority: "high",
        submitterEmail: "alice@example.test",
      }),
      true,
    );
  });

  it("throws for null input", () => {
    assert.throws(() => validateReviewRequest(null), ReviewValidationError);
  });

  it("throws for array input", () => {
    assert.throws(() => validateReviewRequest([]), ReviewValidationError);
  });

  it("throws for string input", () => {
    assert.throws(() => validateReviewRequest("review-001"), ReviewValidationError);
  });

  it("propagates field-level errors", () => {
    assert.throws(
      () =>
        validateReviewRequest({
          reviewId: "../bad",
          status: "pending",
          priority: "low",
          submitterEmail: "a@b.test",
        }),
      ReviewValidationError,
    );
  });
});

// ---------------------------------------------------------------------------
// Performance guards
// ---------------------------------------------------------------------------

describe("guardQueueSize", () => {
  it("passes arrays within the limit", () => {
    assert.equal(guardQueueSize(new Array(LIMITS.MAX_QUEUE_SIZE).fill({})), true);
  });

  it("throws when queue exceeds the safe limit", () => {
    assert.throws(
      () => guardQueueSize(new Array(LIMITS.MAX_QUEUE_SIZE + 1).fill({})),
      ReviewValidationError,
    );
  });

  it("throws for non-array input", () => {
    assert.throws(() => guardQueueSize(null), ReviewValidationError);
    assert.throws(() => guardQueueSize("items"), ReviewValidationError);
  });
});

describe("guardHistorySize", () => {
  it("passes arrays within the limit", () => {
    assert.equal(guardHistorySize(new Array(LIMITS.MAX_HISTORY_SIZE).fill({})), true);
  });

  it("throws when history exceeds the safe limit", () => {
    assert.throws(
      () => guardHistorySize(new Array(LIMITS.MAX_HISTORY_SIZE + 1).fill({})),
      ReviewValidationError,
    );
  });

  it("throws for non-array input", () => {
    assert.throws(() => guardHistorySize({}), ReviewValidationError);
  });
});

describe("guardAttachmentCount", () => {
  it("passes arrays within the limit", () => {
    assert.equal(guardAttachmentCount(new Array(LIMITS.MAX_ATTACHMENT_COUNT).fill({})), true);
  });

  it("throws when attachment count exceeds the safe limit", () => {
    assert.throws(
      () => guardAttachmentCount(new Array(LIMITS.MAX_ATTACHMENT_COUNT + 1).fill({})),
      ReviewValidationError,
    );
  });

  it("throws for non-array input", () => {
    assert.throws(() => guardAttachmentCount("file.pdf"), ReviewValidationError);
  });
});

describe("guardTags", () => {
  it("passes a valid tag array", () => {
    assert.equal(guardTags(["finance", "q2", "urgent"]), true);
  });

  it("passes an empty tag array", () => {
    assert.equal(guardTags([]), true);
  });

  it("throws when tag count exceeds the limit", () => {
    const manyTags = Array.from({ length: LIMITS.MAX_TAG_COUNT + 1 }, (_, i) => `tag-${i}`);
    assert.throws(() => guardTags(manyTags), ReviewValidationError);
  });

  it("throws when a tag is an empty string", () => {
    assert.throws(() => guardTags(["valid", ""]), ReviewValidationError);
  });

  it("throws when a tag exceeds MAX_TAG_LENGTH", () => {
    assert.throws(() => guardTags(["x".repeat(LIMITS.MAX_TAG_LENGTH + 1)]), ReviewValidationError);
  });

  it("throws for non-array input", () => {
    assert.throws(() => guardTags(null), ReviewValidationError);
  });
});

// ---------------------------------------------------------------------------
// Fixture-driven tests
// ---------------------------------------------------------------------------

describe("fixture: valid requests pass validateReviewRequest", () => {
  for (const req of fixture.validRequests) {
    it(`${req.id} passes validation`, () => {
      assert.doesNotThrow(() => validateReviewRequest(req));
    });
  }
});

describe("fixture: hostile inputs are rejected", () => {
  const validators = {
    reviewId: validateReviewId,
    status: validateStatus,
    priority: validatePriority,
    submitterEmail: validateSubmitterEmail,
  };

  for (const entry of fixture.hostileInputs) {
    it(`${entry.id}: "${entry.reason}" is rejected`, () => {
      const fn = validators[entry.field];
      assert.ok(fn, `no validator for field "${entry.field}"`);
      assert.throws(
        () => fn(entry.value),
        ReviewValidationError,
        `expected ReviewValidationError for ${entry.field}="${entry.value}"`,
      );
    });
  }
});

describe("fixture: edge-case sanitization", () => {
  it("edge-001: control chars stripped from note", () => {
    const { note, expectedSanitized } = fixture.edgeCases[0];
    assert.equal(sanitizeNote(note), expectedSanitized);
  });

  it("edge-002: CRLF stripped from subject", () => {
    const { subject, expectedSanitized } = fixture.edgeCases[1];
    assert.equal(sanitizeSubject(subject), expectedSanitized);
  });

  it("edge-003: empty note stays empty", () => {
    const { note, expectedSanitized } = fixture.edgeCases[2];
    assert.equal(sanitizeNote(note), expectedSanitized);
  });

  it("edge-004: whitespace-only note trims to empty", () => {
    const { note, expectedSanitized } = fixture.edgeCases[3];
    assert.equal(sanitizeNote(note), expectedSanitized);
  });
});
