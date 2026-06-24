import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  assessConfidence,
  deriveStatus,
  extractAttendees,
  filterEventsByDateRange,
  groupEventsByStatus,
  isValidIsoDate,
  summariseEvents,
} from "../services/calendar-extraction.service.mjs";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "fixtures", "sample-calendar-emails.json");

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

// ---------------------------------------------------------------------------
// Fixture shape validation
// ---------------------------------------------------------------------------

describe("sample-calendar-emails.json — fixture contract", () => {
  it("has the correct tool identifier", () => {
    assert.equal(fixture.tool, "team-calendar-extraction");
  });

  it("has a version field", () => {
    assert.equal(typeof fixture.version, "number");
    assert.ok(fixture.version >= 1);
  });

  it("sourceMessages is a non-empty array", () => {
    assert.ok(Array.isArray(fixture.sourceMessages));
    assert.ok(fixture.sourceMessages.length > 0);
  });

  it("expectedEvents is a non-empty array", () => {
    assert.ok(Array.isArray(fixture.expectedEvents));
    assert.ok(fixture.expectedEvents.length > 0);
  });

  it("each sourceMessage maps to exactly one expectedEvent", () => {
    const sourceIds = new Set(fixture.sourceMessages.map((m) => m.id));
    const eventSourceIds = fixture.expectedEvents.map((e) => e.sourceMessageId);

    assert.equal(
      eventSourceIds.length,
      fixture.sourceMessages.length,
      "every source message must have a corresponding expected event",
    );

    for (const sid of eventSourceIds) {
      assert.ok(sourceIds.has(sid), `expectedEvent references unknown sourceMessageId: ${sid}`);
    }
  });

  it("sourceMessage ids are unique", () => {
    const ids = fixture.sourceMessages.map((m) => m.id);
    assert.equal(ids.length, new Set(ids).size, "source message ids must be unique");
  });

  it("expectedEvent ids are unique", () => {
    const ids = fixture.expectedEvents.map((e) => e.id);
    assert.equal(ids.length, new Set(ids).size, "expected event ids must be unique");
  });
});

// ---------------------------------------------------------------------------
// Source message field validation
// ---------------------------------------------------------------------------

describe("sample-calendar-emails.json — source message fields", () => {
  for (const msg of fixture.sourceMessages) {
    it(`${msg.id} has required string fields`, () => {
      assert.equal(typeof msg.id, "string");
      assert.ok(msg.id.length > 0);
      assert.equal(typeof msg.from, "string");
      assert.ok(msg.from.includes("@"), `${msg.id}.from must be an email address`);
      assert.equal(typeof msg.subject, "string");
      assert.ok(msg.subject.length > 0);
      assert.equal(typeof msg.body, "string");
      assert.ok(msg.body.length > 0);
    });

    it(`${msg.id} has valid receivedAt ISO timestamp`, () => {
      assert.ok(isValidIsoDate(msg.receivedAt), `${msg.id}.receivedAt must be an ISO date-time`);
    });

    it(`${msg.id} has to/cc arrays`, () => {
      assert.ok(Array.isArray(msg.to), `${msg.id}.to must be an array`);
      assert.ok(Array.isArray(msg.cc), `${msg.id}.cc must be an array`);
    });

    it(`${msg.id} has boolean hasIcsAttachment`, () => {
      assert.equal(
        typeof msg.hasIcsAttachment,
        "boolean",
        `${msg.id}.hasIcsAttachment must be boolean`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Expected event field validation
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = new Set(["confirmed", "tentative", "cancelled"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low"]);

describe("sample-calendar-emails.json — expected event fields", () => {
  for (const ev of fixture.expectedEvents) {
    it(`${ev.id} has required string fields`, () => {
      assert.equal(typeof ev.id, "string");
      assert.ok(ev.id.length > 0);
      assert.equal(typeof ev.title, "string");
      assert.ok(ev.title.length > 0);
      assert.equal(typeof ev.sourceMessageId, "string");
      assert.ok(ev.sourceMessageId.length > 0);
    });

    it(`${ev.id} has valid ISO startAt and endAt`, () => {
      assert.ok(isValidIsoDate(ev.startAt), `${ev.id}.startAt must be an ISO date-time`);
      assert.ok(isValidIsoDate(ev.endAt), `${ev.id}.endAt must be an ISO date-time`);
    });

    it(`${ev.id} endAt is not before startAt`, () => {
      assert.ok(
        new Date(ev.endAt).getTime() >= new Date(ev.startAt).getTime(),
        `${ev.id}.endAt must not be before startAt`,
      );
    });

    it(`${ev.id} has a valid status`, () => {
      assert.ok(
        ALLOWED_STATUSES.has(ev.status),
        `${ev.id}.status must be confirmed | tentative | cancelled`,
      );
    });

    it(`${ev.id} has a valid confidence level`, () => {
      assert.ok(
        ALLOWED_CONFIDENCE.has(ev.confidence),
        `${ev.id}.confidence must be high | medium | low`,
      );
    });

    it(`${ev.id} attendees array is valid`, () => {
      assert.ok(Array.isArray(ev.attendees), `${ev.id}.attendees must be an array`);
      assert.ok(ev.attendees.length > 0, `${ev.id} must have at least one attendee`);

      const organisers = ev.attendees.filter((a) => a.organiser);
      assert.equal(organisers.length, 1, `${ev.id} must have exactly one organiser`);

      for (const att of ev.attendees) {
        assert.ok(att.email.includes("@"), `${ev.id} attendee email must be valid`);
        assert.equal(typeof att.organiser, "boolean");
      }
    });
  }

  it("fixture covers all three status values", () => {
    const statuses = new Set(fixture.expectedEvents.map((e) => e.status));
    for (const s of ["confirmed", "tentative", "cancelled"]) {
      assert.ok(statuses.has(s), `fixture must include at least one ${s} event`);
    }
  });

  it("fixture covers both ICS-backed and non-ICS events", () => {
    const sourceById = new Map(fixture.sourceMessages.map((m) => [m.id, m]));
    const withIcs = fixture.expectedEvents.filter(
      (ev) => sourceById.get(ev.sourceMessageId)?.hasIcsAttachment,
    );
    const withoutIcs = fixture.expectedEvents.filter(
      (ev) => !sourceById.get(ev.sourceMessageId)?.hasIcsAttachment,
    );
    assert.ok(withIcs.length > 0, "fixture must include events with ICS attachment");
    assert.ok(withoutIcs.length > 0, "fixture must include events without ICS attachment");
  });
});

// ---------------------------------------------------------------------------
// Service: assessConfidence
// ---------------------------------------------------------------------------

describe("assessConfidence", () => {
  it("returns high for messages with an ICS attachment", () => {
    const msg = fixture.sourceMessages.find((m) => m.hasIcsAttachment);
    assert.equal(assessConfidence(msg), "high");
  });

  it("returns medium for messages with one strong event keyword", () => {
    const result = assessConfidence({
      subject: "Interview tomorrow",
      body: "Please confirm the time.",
      hasIcsAttachment: false,
    });
    assert.equal(result, "medium");
  });

  it("returns low for messages without keywords", () => {
    const result = assessConfidence({
      subject: "Invoice attached",
      body: "Please find the invoice attached.",
      hasIcsAttachment: false,
    });
    assert.equal(result, "low");
  });

  it("returns high for messages with two or more strong event keywords", () => {
    const result = assessConfidence({
      subject: "Team meeting and standup today",
      body: "Please join.",
      hasIcsAttachment: false,
    });
    assert.equal(result, "high");
  });
});

// ---------------------------------------------------------------------------
// Service: deriveStatus
// ---------------------------------------------------------------------------

describe("deriveStatus", () => {
  it("returns cancelled when subject contains 'cancelled'", () => {
    const msg = fixture.sourceMessages.find((m) => /cancelled/i.test(m.subject));
    assert.ok(msg, "fixture must include a cancellation message");
    assert.equal(deriveStatus(msg), "cancelled");
  });

  it("returns tentative for a message with 'tentative' in the subject", () => {
    const result = deriveStatus({
      subject: "Proposed: Tentative meeting",
      body: "Pending confirmation.",
    });
    assert.equal(result, "tentative");
  });

  it("returns tentative for a message with 'proposed' in the subject", () => {
    const msg = fixture.sourceMessages.find((m) => /proposed/i.test(m.subject));
    assert.ok(msg, "fixture must include a proposed-status message");
    assert.equal(deriveStatus(msg), "tentative");
  });

  it("returns confirmed for a regular invitation with no status keywords", () => {
    const msg = fixture.sourceMessages.find((m) => m.id === "msg-cal-001");
    assert.equal(deriveStatus(msg), "confirmed");
  });
});

// ---------------------------------------------------------------------------
// Service: extractAttendees
// ---------------------------------------------------------------------------

describe("extractAttendees", () => {
  it("includes all to and cc addresses", () => {
    const msg = fixture.sourceMessages.find((m) => m.id === "msg-cal-001");
    const attendees = extractAttendees(msg);
    const emails = attendees.map((a) => a.email);

    for (const addr of [...msg.to, ...msg.cc]) {
      assert.ok(emails.includes(addr.toLowerCase()), `${addr} should be in attendee list`);
    }
  });

  it("marks the sender as organiser", () => {
    const msg = fixture.sourceMessages.find((m) => m.id === "msg-cal-001");
    const attendees = extractAttendees(msg);
    const organiser = attendees.find((a) => a.organiser);
    assert.ok(organiser);
    assert.equal(organiser.email, msg.from.toLowerCase());
  });

  it("produces exactly one organiser per message", () => {
    for (const msg of fixture.sourceMessages) {
      const attendees = extractAttendees(msg);
      const organisers = attendees.filter((a) => a.organiser);
      assert.equal(organisers.length, 1, `${msg.id} must have exactly one organiser`);
    }
  });

  it("deduplicates addresses that appear in both to and cc", () => {
    const msg = {
      from: "a@example.test",
      to: ["b@example.test", "c@example.test"],
      cc: ["b@example.test"],
    };
    const attendees = extractAttendees(msg);
    const emails = attendees.map((a) => a.email);
    assert.equal(emails.length, new Set(emails).size, "attendee list must not have duplicates");
  });
});

// ---------------------------------------------------------------------------
// Service: isValidIsoDate
// ---------------------------------------------------------------------------

describe("isValidIsoDate", () => {
  it("accepts valid ISO date-time strings", () => {
    assert.equal(isValidIsoDate("2026-06-20T10:00:00Z"), true);
    assert.equal(isValidIsoDate("2026-06-20T10:00:00.000Z"), true);
  });

  it("rejects date-only strings", () => {
    assert.equal(isValidIsoDate("2026-06-20"), false);
  });

  it("rejects null and non-strings", () => {
    assert.equal(isValidIsoDate(null), false);
    assert.equal(isValidIsoDate(12345), false);
    assert.equal(isValidIsoDate(undefined), false);
  });

  it("rejects invalid date text", () => {
    assert.equal(isValidIsoDate("not-a-date"), false);
    assert.equal(isValidIsoDate("2026-99-99T00:00:00Z"), false);
  });
});

// ---------------------------------------------------------------------------
// Service: filterEventsByDateRange
// ---------------------------------------------------------------------------

describe("filterEventsByDateRange", () => {
  it("returns events within the range", () => {
    const result = filterEventsByDateRange(fixture.expectedEvents, {
      start: "2026-06-24",
      end: "2026-06-26",
    });
    // Events on 24, 25, 26 June: event-001 (26th), event-002 (25th), event-004 (24th)
    assert.equal(result.length, 3);
  });

  it("returns empty array when no events fall in the range", () => {
    const result = filterEventsByDateRange(fixture.expectedEvents, {
      start: "2025-01-01",
      end: "2025-12-31",
    });
    assert.equal(result.length, 0);
  });

  it("includes an event on the exact boundary date", () => {
    const result = filterEventsByDateRange(fixture.expectedEvents, {
      start: "2026-06-30",
      end: "2026-06-30",
    });
    // Only the security workshop on 30 June
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "event-005");
  });
});

// ---------------------------------------------------------------------------
// Service: groupEventsByStatus
// ---------------------------------------------------------------------------

describe("groupEventsByStatus", () => {
  it("correctly separates events by status", () => {
    const groups = groupEventsByStatus(fixture.expectedEvents);

    assert.ok(groups.confirmed.every((e) => e.status === "confirmed"));
    assert.ok(groups.tentative.every((e) => e.status === "tentative"));
    assert.ok(groups.cancelled.every((e) => e.status === "cancelled"));

    const total = groups.confirmed.length + groups.tentative.length + groups.cancelled.length;
    assert.equal(total, fixture.expectedEvents.length);
  });

  it("returns empty arrays when no events exist", () => {
    const groups = groupEventsByStatus([]);
    assert.equal(groups.confirmed.length, 0);
    assert.equal(groups.tentative.length, 0);
    assert.equal(groups.cancelled.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Service: summariseEvents
// ---------------------------------------------------------------------------

describe("summariseEvents", () => {
  it("returns correct totals for the full fixture", () => {
    const summary = summariseEvents(fixture.expectedEvents);

    assert.equal(summary.total, fixture.expectedEvents.length);
    assert.equal(
      summary.confirmed + summary.tentative + summary.cancelled,
      summary.total,
      "status counts must sum to total",
    );
    assert.ok(summary.highConfidence >= 0);
  });

  it("counts only high-confidence events correctly", () => {
    const highCount = fixture.expectedEvents.filter((e) => e.confidence === "high").length;
    const summary = summariseEvents(fixture.expectedEvents);
    assert.equal(summary.highConfidence, highCount);
  });

  it("returns all-zero summary for empty array", () => {
    const summary = summariseEvents([]);
    assert.equal(summary.total, 0);
    assert.equal(summary.confirmed, 0);
    assert.equal(summary.tentative, 0);
    assert.equal(summary.cancelled, 0);
    assert.equal(summary.highConfidence, 0);
  });
});
