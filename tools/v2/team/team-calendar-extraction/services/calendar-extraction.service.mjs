/**
 * calendar-extraction.service.mjs
 *
 * Pure-function service layer for the Team Calendar Extraction tool.
 * No external dependencies — designed to run in isolation with Node.js.
 *
 * This module is intentionally self-contained so that contributors can
 * reason about and test the logic without the main application shell.
 */

/** @typedef {"high"|"medium"|"low"} ExtractionConfidence */
/** @typedef {"confirmed"|"tentative"|"cancelled"} EventStatus */

/**
 * Keywords that strongly suggest a calendar event is present.
 * @type {string[]}
 */
const STRONG_EVENT_KEYWORDS = [
  "meeting",
  "call",
  "sync",
  "standup",
  "stand-up",
  "interview",
  "demo",
  "presentation",
  "workshop",
  "conference",
  "webinar",
];

/**
 * Patterns that indicate a cancellation.
 * @type {RegExp[]}
 */
const CANCEL_PATTERNS = [/\bcancell?ed\b/i, /\bcancell?ation\b/i, /\bno longer\b/i];

/**
 * Patterns that indicate a tentative invitation.
 * @type {RegExp[]}
 */
const TENTATIVE_PATTERNS = [/\btentative\b/i, /\bmaybe\b/i, /\bpending\b/i, /\bproposed\b/i];

/**
 * Returns the extraction confidence for a source message based on keyword
 * density and the presence of an ICS attachment hint.
 *
 * @param {object} message - A SourceMessage object.
 * @returns {ExtractionConfidence}
 */
export function assessConfidence(message) {
  if (message.hasIcsAttachment) return "high";

  const text = `${message.subject} ${message.body}`.toLowerCase();
  const matchCount = STRONG_EVENT_KEYWORDS.filter((kw) => text.includes(kw)).length;

  if (matchCount >= 2) return "high";
  if (matchCount === 1) return "medium";
  return "low";
}

/**
 * Determines the EventStatus for a message.
 *
 * @param {object} message - A SourceMessage object.
 * @returns {EventStatus}
 */
export function deriveStatus(message) {
  const text = `${message.subject} ${message.body}`;

  if (CANCEL_PATTERNS.some((re) => re.test(text))) return "cancelled";
  if (TENTATIVE_PATTERNS.some((re) => re.test(text))) return "tentative";
  return "confirmed";
}

/**
 * Builds an EventAttendee list from a message's to/cc headers.
 * The sender is marked as the organiser.
 *
 * @param {object} message - A SourceMessage object.
 * @returns {Array<{email: string, name?: string, organiser: boolean}>}
 */
export function extractAttendees(message) {
  const organiserEmail = message.from.toLowerCase();

  const uniqueEmails = new Set(
    [...(message.to ?? []), ...(message.cc ?? [])].map((e) => e.toLowerCase()),
  );

  const attendees = [...uniqueEmails].map((email) => ({
    email,
    organiser: email === organiserEmail,
  }));

  // Ensure the sender is always in the list as organiser.
  if (!attendees.some((a) => a.email === organiserEmail)) {
    attendees.unshift({ email: organiserEmail, organiser: true });
  }

  return attendees;
}

/**
 * Returns true when the given ISO date string is structurally valid.
 *
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidIsoDate(dateStr) {
  if (typeof dateStr !== "string") return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && dateStr.includes("T");
}

/**
 * Filters an array of CalendarEvents to those whose startAt falls within
 * [rangeStart, rangeEnd] (both inclusive, compared by date portion only).
 *
 * @param {object[]} events - Array of CalendarEvent objects.
 * @param {{ start: string, end: string }} range - ISO date strings (YYYY-MM-DD).
 * @returns {object[]}
 */
export function filterEventsByDateRange(events, range) {
  const startMs = new Date(range.start).getTime();
  const endMs = new Date(range.end).getTime() + 86_400_000; // end of day

  return events.filter((ev) => {
    const evMs = new Date(ev.startAt).getTime();
    return evMs >= startMs && evMs < endMs;
  });
}

/**
 * Groups events by their status.
 *
 * @param {object[]} events - Array of CalendarEvent objects.
 * @returns {{ confirmed: object[], tentative: object[], cancelled: object[] }}
 */
export function groupEventsByStatus(events) {
  return {
    confirmed: events.filter((e) => e.status === "confirmed"),
    tentative: events.filter((e) => e.status === "tentative"),
    cancelled: events.filter((e) => e.status === "cancelled"),
  };
}

/**
 * Returns summary statistics for a set of extracted events.
 *
 * @param {object[]} events - Array of CalendarEvent objects.
 * @returns {{ total: number, confirmed: number, tentative: number, cancelled: number, highConfidence: number }}
 */
export function summariseEvents(events) {
  return {
    total: events.length,
    confirmed: events.filter((e) => e.status === "confirmed").length,
    tentative: events.filter((e) => e.status === "tentative").length,
    cancelled: events.filter((e) => e.status === "cancelled").length,
    highConfidence: events.filter((e) => e.confidence === "high").length,
  };
}
