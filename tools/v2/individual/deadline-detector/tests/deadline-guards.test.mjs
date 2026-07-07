import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEADLINE_GUARD_LIMITS,
  DeadlineGuardError,
  guardAttachmentMetadata,
  guardDeadlineMessageBatch,
  guardDetectionRequest,
  guardHistoryWindow,
  sanitizeDeadlineMessage,
  sanitizeDeadlineText,
  validateIsoTimestamp,
  validateMessageId,
  validateSender,
  validateSourceType,
  validateTimezone,
} from "../guards/deadline-guards.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(currentDir, "..", "fixtures", "hostile-deadline-inputs.json"), "utf8"),
);

const baseMessage = fixture.validMessages[0];

function assertGuardError(fn, field) {
  assert.throws(
    fn,
    (error) => error instanceof DeadlineGuardError && error.field === field,
    `expected DeadlineGuardError for ${field}`,
  );
}

describe("Deadline Detector guards - text sanitization", () => {
  for (const entry of fixture.sanitizationCases) {
    it(`sanitizes ${entry.field}`, () => {
      assert.equal(sanitizeDeadlineText(entry.input), entry.expected);
    });
  }

  it("returns an empty string for non-string text", () => {
    assert.equal(sanitizeDeadlineText(null), "");
    assert.equal(sanitizeDeadlineText(42), "");
  });

  it("truncates text to the provided limit", () => {
    assert.equal(sanitizeDeadlineText("abcdef", 3), "abc");
  });
});

describe("Deadline Detector guards - field validators", () => {
  it("accepts safe message ids", () => {
    assert.equal(validateMessageId("msg-safe_001"), "msg-safe_001");
  });

  it("rejects path-like ids", () => {
    assertGuardError(() => validateMessageId("../../mailbox"), "id");
  });

  it("accepts allowlisted source types", () => {
    assert.equal(validateSourceType("email"), "email");
    assert.equal(validateSourceType("project-update"), "project-update");
  });

  it("rejects unknown source types", () => {
    assertGuardError(() => validateSourceType("live-inbox"), "type");
  });

  it("rejects sender CRLF injection", () => {
    assertGuardError(
      () => validateSender("sender@example.test\r\nBcc: victim@example.test"),
      "sender",
    );
  });

  it("rejects malformed timestamps", () => {
    assertGuardError(() => validateIsoTimestamp("not-a-date", "receivedAt"), "receivedAt");
  });

  it("rejects unsafe timezone characters", () => {
    assertGuardError(() => validateTimezone("UTC\r\nX-Timezone: injected"), "userTimezone");
  });
});

describe("Deadline Detector guards - message validation", () => {
  it("returns a sanitized copy without mutating input", () => {
    const input = {
      ...baseMessage,
      subject: " <b>Due</b>\u0000 tomorrow ",
      body: "Submit\u200b by tomorrow.",
    };
    const sanitized = sanitizeDeadlineMessage(input);

    assert.equal(sanitized.subject, "Due tomorrow");
    assert.equal(sanitized.body, "Submit by tomorrow.");
    assert.equal(input.subject, " <b>Due</b>\u0000 tomorrow ");
  });

  for (const entry of fixture.hostileMessages) {
    it(`rejects ${entry.id}: ${entry.reason}`, () => {
      assertGuardError(
        () => sanitizeDeadlineMessage({ ...baseMessage, ...entry.patch }),
        entry.field,
      );
    });
  }

  it("rejects non-object messages", () => {
    assertGuardError(() => sanitizeDeadlineMessage(null), "message");
    assertGuardError(() => sanitizeDeadlineMessage([]), "message");
  });

  it("guards and sanitizes a bounded message batch", () => {
    const result = guardDeadlineMessageBatch([baseMessage]);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, baseMessage.id);
  });

  it("rejects oversized message batches before detection", () => {
    const messages = Array.from(
      { length: DEADLINE_GUARD_LIMITS.MAX_MESSAGE_BATCH_SIZE + 1 },
      (_, index) => ({ ...baseMessage, id: `msg-${index}` }),
    );

    assertGuardError(() => guardDeadlineMessageBatch(messages), "messages");
  });
});

describe("Deadline Detector guards - request and collection limits", () => {
  it("validates a future adapter request shape", () => {
    const request = {
      messages: [baseMessage],
      options: {
        now: "2026-06-18T09:00:00Z",
        defaultTimezone: "UTC",
      },
    };

    const guarded = guardDetectionRequest(request);
    assert.equal(guarded.messages.length, 1);
    assert.equal(guarded.options.now, "2026-06-18T09:00:00Z");
    assert.equal(guarded.options.defaultTimezone, "UTC");
  });

  it("rejects attachment content and accepts metadata", () => {
    const metadata = guardAttachmentMetadata([
      {
        name: fixture.sanitizationCases[2].input,
        sizeBytes: 1024,
      },
    ]);

    assert.equal(metadata[0].name, fixture.sanitizationCases[2].expected);
    assertGuardError(
      () => guardAttachmentMetadata([{ name: "invoice.pdf", sizeBytes: 10, content: "raw" }]),
      "attachments",
    );
  });

  it("rejects oversized attachment lists", () => {
    const attachments = Array.from(
      { length: DEADLINE_GUARD_LIMITS.MAX_ATTACHMENT_COUNT + 1 },
      (_, index) => ({ name: `file-${index}.txt`, sizeBytes: 100 }),
    );

    assertGuardError(() => guardAttachmentMetadata(attachments), "attachments");
  });

  it("rejects oversized history windows", () => {
    const history = Array.from(
      { length: DEADLINE_GUARD_LIMITS.MAX_HISTORY_EVENTS + 1 },
      (_, index) => ({ id: `event-${index}` }),
    );

    assertGuardError(() => guardHistoryWindow(history), "history");
  });
});
