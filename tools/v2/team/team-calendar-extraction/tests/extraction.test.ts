import { describe, it, expect, vi } from "vitest";
import { processTeamEmails, extractEventFromEmailText } from "../services/extraction.service";
import { parseIcsContent } from "../services/ics-parser";
import {
  validEmails,
  generateLargeIcsContent,
  generateOverlyLongLineIcs,
  maliciousEmails,
} from "../fixtures/calendar.fixtures";
import type { EmailData } from "../types";

describe("Team Calendar Extraction - Core Behavior", () => {
  it("extracts events from a valid email batch (ICS attachment + text scan)", () => {
    const result = processTeamEmails(validEmails);
    // email_2 contributes a parsed ICS VEVENT; email_1 is a text-extracted sync.
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    expect(result.stats.eventsExtracted).toBe(2);
    expect(result.errors).toHaveLength(0);

    const titles = result.events.map((e) => e.title);
    expect(titles).toContain("Sprint Planning");
    expect(titles.some((t) => /kickoff/i.test(t))).toBe(true);
  });

  it("emits a progress callback that reaches 100% for the full batch", () => {
    const onProgress = vi.fn();
    processTeamEmails(validEmails, onProgress);
    expect(onProgress).toHaveBeenCalled();
    const last = onProgress.mock.calls[onProgress.mock.calls.length - 1][0];
    expect(last).toBe(100);
  });

  it("extracts a structured event from a plain meeting email (no attachment)", () => {
    const email: EmailData = {
      id: "email_text_1",
      subject: "Weekly Sync",
      from: "lead@company.com",
      to: ["dev@company.com"],
      body: "Let's meet on 2026-08-15 to review the roadmap. Join the call.",
      hasAttachments: false,
    };
    const event = extractEventFromEmailText(email);
    expect(event).not.toBeNull();
    expect(event?.organizer).toBe("lead@company.com");
    expect(event?.attendees).toContain("dev@company.com");
    expect(event?.startDate).toMatch(/^2026-08-15T/);
    // End is one hour after start.
    expect(event?.endDate).toMatch(/^2026-08-15T/);
  });

  it("returns null for emails with no meeting indicator word", () => {
    const email: EmailData = {
      id: "email_no_meeting",
      subject: "Lunch order",
      from: "friend@company.com",
      to: ["dev@company.com"],
      body: "What do you want to eat today? I am hungry and will bring snacks.",
      hasAttachments: false,
    };
    expect(extractEventFromEmailText(email)).toBeNull();
  });

  it("truncates oversized email batches to the per-batch limit (50)", () => {
    const big: EmailData[] = Array.from({ length: 55 }, (_, i) => ({
      id: `bulk_${i}`,
      subject: "Daily Standup",
      from: `person${i}@company.com`,
      to: ["team@company.com"],
      body: "Standup at 2026-09-01. Quick sync.",
      hasAttachments: false,
    }));
    const result = processTeamEmails(big);
    expect(result.events.length).toBeLessThanOrEqual(50);
    expect(result.sanitizationLog.some((l) => l.includes("truncated"))).toBe(true);
  });

  it("handles empty input without throwing", () => {
    const result = processTeamEmails([]);
    expect(result.events).toHaveLength(0);
    expect(result.stats.eventsExtracted).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("sanitizes malicious content while still producing safe events", () => {
    const result = processTeamEmails(maliciousEmails);
    result.events.forEach((event) => {
      expect(event.title).not.toContain("<script>");
      expect(event.description).not.toContain("<iframe");
      expect(event.organizer).toBe("attacker@malicious.com");
    });
  });
});

describe("Team Calendar Extraction - ICS Parser (behavioral)", () => {
  it("parses a well-formed VEVENT with organizer and attendees", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:uid_core_1
SUMMARY:Quarterly Review
DTSTART:20261001T090000Z
DTEND:20261001T100000Z
LOCATION:Board Room
ORGANIZER;CN=Boss:mailto:boss@company.com
ATTENDEE;CN=A:mailto:a@company.com
END:VEVENT
END:VCALENDAR`;
    const { events, errors } = parseIcsContent(ics);
    expect(errors).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Quarterly Review");
    expect(events[0].organizer).toBe("boss@company.com");
    expect(events[0].attendees).toContain("a@company.com");
  });

  it("caps events at the default limit of 100", () => {
    const { events } = parseIcsContent(generateLargeIcsContent(120));
    expect(events).toHaveLength(100);
  });

  it("records an error for lines exceeding the length limit but still parses", () => {
    const { events, errors } = parseIcsContent(generateOverlyLongLineIcs());
    expect(events).toHaveLength(1);
    expect(errors.some((e) => e.includes("maximum length"))).toBe(true);
  });
});
