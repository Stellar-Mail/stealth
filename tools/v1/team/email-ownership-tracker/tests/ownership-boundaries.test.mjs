import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LIMITS,
  OwnershipBoundaryError,
  deriveCurrentOwners,
  guardOwnershipHistory,
  normalizeEmail,
  prepareOwnershipHistory,
  sanitizeAttachmentMetadata,
  sanitizeTags,
  sanitizeText,
  validateOwnershipAction,
  validateOwnershipEvent,
  validateTeamMembers,
  validateTrackerId,
} from "../guards/ownership-boundaries.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "hostile-ownership-inputs.json"), "utf8"),
);

function validEvent(overrides = {}) {
  return {
    eventId: "evt-valid-001",
    messageId: "msg-valid-001@example.test",
    action: "claim",
    actorEmail: "actor@example.test",
    ownerEmail: "owner@example.test",
    ownerDisplayName: "Owner Name",
    createdAt: "2026-07-01T09:00:00.000Z",
    reason: "Claimed for team handling.",
    teamId: "support-team",
    tags: ["billing"],
    attachments: [],
    ...overrides,
  };
}

describe("validateTrackerId", () => {
  it("accepts compact ids used as event or message keys", () => {
    assert.equal(
      validateTrackerId("msg-2026.001@example.test", "messageId"),
      "msg-2026.001@example.test",
    );
  });

  it("rejects path traversal and path separators", () => {
    assert.throws(() => validateTrackerId("../secret", "eventId"), OwnershipBoundaryError);
    assert.throws(() => validateTrackerId("team\\secret", "eventId"), OwnershipBoundaryError);
  });

  it("rejects oversized ids before they can become keys", () => {
    assert.throws(
      () => validateTrackerId("a".repeat(LIMITS.MAX_EVENT_ID_LENGTH + 1), "eventId"),
      OwnershipBoundaryError,
    );
  });
});

describe("normalizeEmail", () => {
  it("normalizes safe emails", () => {
    assert.equal(normalizeEmail(" Owner@Example.Test "), "owner@example.test");
  });

  it("rejects malformed or injected emails", () => {
    assert.throws(() => normalizeEmail("owner.example.test"), OwnershipBoundaryError);
    assert.throws(
      () => normalizeEmail("owner@example.test\r\nBcc: x@example.test"),
      OwnershipBoundaryError,
    );
    assert.throws(() => normalizeEmail("owner\0@example.test"), OwnershipBoundaryError);
  });
});

describe("validateOwnershipAction", () => {
  it("accepts known ownership actions case-insensitively", () => {
    assert.equal(validateOwnershipAction("TRANSFER"), "transfer");
  });

  it("rejects unsupported actions", () => {
    assert.throws(() => validateOwnershipAction("delete"), OwnershipBoundaryError);
  });
});

describe("sanitizeText", () => {
  it("removes control characters and HTML-like tags", () => {
    assert.equal(sanitizeText("<b>Alice</b>\0 Smith", 120, "ownerDisplayName"), "Alice Smith");
  });

  it("rejects object text payloads", () => {
    assert.throws(() => sanitizeText({ html: "<b>x</b>" }, 50, "reason"), OwnershipBoundaryError);
  });

  it("truncates long primitive text", () => {
    assert.equal(sanitizeText("x".repeat(20), 8, "reason").length, 8);
  });
});

describe("sanitizeTags", () => {
  it("deduplicates and normalizes tags", () => {
    assert.deepEqual(sanitizeTags(["VIP", "vip", "Billing"]), ["vip", "billing"]);
  });

  it("rejects unsafe tag characters and oversized tag arrays", () => {
    assert.throws(() => sanitizeTags(["../private"]), OwnershipBoundaryError);
    assert.throws(
      () =>
        sanitizeTags(
          Array.from({ length: LIMITS.MAX_TAG_COUNT + 1 }, (_, index) => `tag-${index}`),
        ),
      OwnershipBoundaryError,
    );
  });
});

describe("sanitizeAttachmentMetadata", () => {
  it("keeps metadata only and normalizes content types", () => {
    assert.deepEqual(
      sanitizeAttachmentMetadata([{ filename: "Invoice.pdf", type: "APPLICATION/PDF", size: 12 }]),
      [{ name: "Invoice.pdf", contentType: "application/pdf", sizeBytes: 12 }],
    );
  });

  it("rejects invalid attachment shapes and negative sizes", () => {
    assert.throws(() => sanitizeAttachmentMetadata(["invoice.pdf"]), OwnershipBoundaryError);
    assert.throws(
      () => sanitizeAttachmentMetadata([{ name: "invoice.pdf", sizeBytes: -1 }]),
      OwnershipBoundaryError,
    );
  });

  it("rejects attachment lists over count or byte budgets", () => {
    assert.throws(
      () =>
        sanitizeAttachmentMetadata(
          new Array(LIMITS.MAX_ATTACHMENT_COUNT + 1).fill({ name: "a", sizeBytes: 1 }),
        ),
      OwnershipBoundaryError,
    );
    assert.throws(
      () =>
        sanitizeAttachmentMetadata([
          { name: "big.bin", sizeBytes: LIMITS.MAX_ATTACHMENT_BYTES + 1 },
        ]),
      OwnershipBoundaryError,
    );
  });
});

describe("validateTeamMembers", () => {
  it("normalizes safe team member records", () => {
    assert.deepEqual(validateTeamMembers(fixture.teamMembers), [
      {
        id: "member-1",
        email: "lead@example.test",
        displayName: "Lead Reviewer",
      },
      {
        id: "member-2",
        email: "backup@example.test",
        displayName: "Backup Reviewer",
      },
    ]);
  });

  it("rejects oversized team directories", () => {
    assert.throws(
      () =>
        validateTeamMembers(
          Array.from({ length: LIMITS.MAX_TEAM_MEMBERS + 1 }, (_, index) => ({
            id: `member-${index}`,
            email: `member-${index}@example.test`,
          })),
        ),
      OwnershipBoundaryError,
    );
  });
});

describe("validateOwnershipEvent", () => {
  it("normalizes a complete ownership event", () => {
    const event = validateOwnershipEvent(
      validEvent({ ownerEmail: "Owner@Example.Test", tags: ["VIP", "vip"] }),
    );
    assert.equal(event.ownerEmail, "owner@example.test");
    assert.deepEqual(event.tags, ["vip"]);
    assert.equal(event.createdAt, "2026-07-01T09:00:00.000Z");
  });

  it("allows release events without ownerEmail", () => {
    const event = validateOwnershipEvent(validEvent({ action: "release", ownerEmail: "" }));
    assert.equal(event.action, "release");
    assert.equal(event.ownerEmail, null);
  });

  it("requires ownerEmail for ownership-setting actions", () => {
    assert.throws(
      () => validateOwnershipEvent(validEvent({ action: "assign", ownerEmail: "" })),
      OwnershipBoundaryError,
    );
  });

  it("rejects non-object events and invalid timestamps", () => {
    assert.throws(() => validateOwnershipEvent(null), OwnershipBoundaryError);
    assert.throws(
      () => validateOwnershipEvent(validEvent({ createdAt: "not-a-date" })),
      OwnershipBoundaryError,
    );
    assert.throws(
      () => validateOwnershipEvent(validEvent({ createdAt: "2026-07-01" })),
      OwnershipBoundaryError,
    );
  });
});

describe("history guards", () => {
  it("rejects non-array and oversized histories before mapping events", () => {
    assert.throws(() => guardOwnershipHistory(null), OwnershipBoundaryError);
    assert.throws(
      () => guardOwnershipHistory(new Array(LIMITS.MAX_HISTORY_EVENTS + 1).fill(validEvent())),
      OwnershipBoundaryError,
    );
  });

  it("prepares fixture events", () => {
    const events = prepareOwnershipHistory(fixture.validEvents);
    assert.equal(events.length, 2);
    assert.equal(events[0].ownerEmail, "owner@example.test");
  });

  it("derives current owners in one bounded pass", () => {
    const summary = deriveCurrentOwners([
      validEvent({
        eventId: "evt-1",
        messageId: "msg-1@example.test",
        ownerEmail: "one@example.test",
      }),
      validEvent({
        eventId: "evt-2",
        messageId: "msg-2@example.test",
        ownerEmail: "two@example.test",
      }),
      validEvent({
        eventId: "evt-3",
        messageId: "msg-1@example.test",
        action: "release",
        ownerEmail: "",
      }),
    ]);

    assert.equal(summary.count, 1);
    assert.equal(summary.owners[0].messageId, "msg-2@example.test");
  });
});

describe("fixture hostile fields", () => {
  const fieldMutators = {
    eventId: (value) => validEvent({ eventId: value }),
    messageId: (value) => validEvent({ messageId: value }),
    action: (value) => validEvent({ action: value }),
    actorEmail: (value) => validEvent({ actorEmail: value }),
    ownerEmail: (value) => validEvent({ ownerEmail: value }),
    createdAt: (value) => validEvent({ createdAt: value }),
    tags: (value) => validEvent({ tags: value }),
    attachments: (value) => validEvent({ attachments: value }),
  };

  for (const hostile of fixture.hostileFields) {
    it(`${hostile.id}: ${hostile.reason}`, () => {
      assert.throws(
        () => validateOwnershipEvent(fieldMutators[hostile.field](hostile.value)),
        OwnershipBoundaryError,
      );
    });
  }
});

describe("fixture text cases", () => {
  it("sanitizes HTML/control display names", () => {
    const htmlCase = fixture.textCases.find((entry) => entry.id === "html-display-name");
    assert.equal(
      sanitizeText(htmlCase.input, LIMITS.MAX_DISPLAY_NAME_LENGTH, "ownerDisplayName"),
      htmlCase.expected,
    );
  });

  it("truncates long reasons to the documented budget", () => {
    const longReason = fixture.textCases.find((entry) => entry.id === "long-reason");
    const output = sanitizeText(
      "x".repeat(longReason.inputLength),
      LIMITS.MAX_REASON_LENGTH,
      "reason",
    );
    assert.equal(output.length, longReason.expectedLength);
  });
});
