import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeText, sanitizeFilename } from "../services/sanitization";
import { validateEmail, validateCalendarEvent } from "../services/validation";
import { parseIcsContent, parseIcsDate } from "../services/ics-parser";
import { processTeamEmails } from "../services/extraction.service";
import {
  validEmails,
  maliciousEmails,
  generateLargeIcsContent,
  generateOverlyLongLineIcs,
} from "../fixtures/calendar.fixtures";

describe("Team Calendar Extraction - Input Sanitization", () => {
  it("should strip malicious script tags and contents", () => {
    const xss = "Hello <script>alert('xss')</script> World";
    const result = sanitizeHtml(xss);
    expect(result.content).toBe("Hello  World");
    expect(result.actionsTaken).toBe(1);
  });

  it("should strip iframe and event handlers", () => {
    const xss = '<iframe src="http://evil.com"></iframe><div onclick="alert(1)">Click</div>';
    const result = sanitizeHtml(xss);
    expect(result.content).toBe("<div>Click</div>");
    expect(result.actionsTaken).toBe(2);
  });

  it("should sanitize dangerous protocols (javascript:, data:)", () => {
    const xss = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(xss);
    expect(result.content).toBe('<a href="#">Link</a>');
    expect(result.actionsTaken).toBe(1);
  });

  it("should prevent directory traversal in filename sanitization", () => {
    const dangerous = "../../../etc/passwd";
    const clean = sanitizeFilename(dangerous);
    expect(clean).not.toContain("..");
    expect(clean).not.toContain("/");
    expect(clean).toBe("passwd");
  });
});

describe("Team Calendar Extraction - Validation Constraints", () => {
  it("should validate standard email correctly", () => {
    const valid = validateEmail("team@company.com");
    expect(valid).toBeNull();

    const invalid = validateEmail("not-an-email");
    expect(invalid).not.toBeNull();
    expect(invalid?.code).toBe("INVALID_FORMAT");
  });

  it("should reject too long email addresses", () => {
    const longEmail = "a".repeat(250) + "@company.com";
    const invalid = validateEmail(longEmail);
    expect(invalid).not.toBeNull();
    expect(invalid?.code).toBe("MAX_LENGTH_EXCEEDED");
  });

  it("should reject events with invalid attendee list size", () => {
    const dummyEvent = {
      id: "event_1",
      title: "Huge Event",
      startDate: "2026-06-19T09:00:00Z",
      endDate: "2026-06-19T10:00:00Z",
      organizer: "host@test.com",
      attendees: Array(60).fill("user@test.com"), // exceeds max of 50
    };
    const validation = validateCalendarEvent(dummyEvent);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.code === "MAX_ATTENDEES_EXCEEDED")).toBe(true);
  });
});

describe("Team Calendar Extraction - Safe iCalendar (.ics) Parser", () => {
  it("should parse standard valid ICS date formats", () => {
    expect(parseIcsDate("20260619T103000Z")).toBe("2026-06-19T10:30:00Z");
    expect(parseIcsDate("20260619")).toBe("2026-06-19T00:00:00Z");
  });

  it("should restrict file processing size limits", () => {
    const largeContent = "a".repeat(3 * 1024 * 1024); // 3MB (limit is 2MB)
    const result = parseIcsContent(largeContent);
    expect(result.events).toHaveLength(0);
    expect(result.errors[0]).toContain("exceeds maximum allowed size");
  });

  it("should truncate overly long property lines", () => {
    const content = generateOverlyLongLineIcs();
    const result = parseIcsContent(content);
    expect(result.events).toHaveLength(1);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain("exceeds maximum length");
  });

  it("should enforce maximum event limits", () => {
    const content = generateLargeIcsContent(120); // limit is 100
    const result = parseIcsContent(content);
    expect(result.events).toHaveLength(100);
    expect(result.errors.some((e) => e.includes("limit of 100 reached"))).toBe(true);
  });
});

describe("Team Calendar Extraction - Orchestration and Extraction", () => {
  it("should safely process valid team emails and extract events", () => {
    const result = processTeamEmails(validEmails);
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
    expect(result.stats.eventsExtracted).toBe(2);
  });

  it("should drop/sanitize malicious payload events", () => {
    const result = processTeamEmails(maliciousEmails);
    // Malicious email might trigger XSS or invalid schema and gets sanitized or validated
    result.events.forEach((event) => {
      expect(event.title).not.toContain("<script>");
      expect(event.description).not.toContain("<iframe");
    });
  });
});
