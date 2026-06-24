import { CalendarEvent, ParseLimits } from "../types";
import { sanitizeText, sanitizeEmail, sanitizeHtml } from "./sanitization";

const DEFAULT_LIMITS: ParseLimits = {
  maxFileSize: 2 * 1024 * 1024, // 2MB
  maxLineLength: 1000,
  maxEvents: 100,
  maxPropertyLength: 2000,
  maxAttendees: 50,
};

/**
 * Parses ICS Datetime format to ISO 8601 string
 * e.g., "20260619T090000Z" -> "2026-06-19T09:00:00.000Z"
 * e.g., "20260619" -> "2026-06-19T00:00:00.000Z"
 */
export function parseIcsDate(val: string): string {
  if (!val) return "";
  const clean = val.replace(/[-:]/g, "").trim();

  if (clean.length >= 8) {
    const year = clean.substring(0, 4);
    const month = clean.substring(4, 6);
    const day = clean.substring(6, 8);

    if (clean.length >= 15 && (clean[8] === "T" || clean[8] === "t")) {
      const hour = clean.substring(9, 11);
      const min = clean.substring(11, 13);
      const sec = clean.substring(13, 15);
      const isUtc = clean.endsWith("Z") || clean.endsWith("z");
      return `${year}-${month}-${day}T${hour}:${min}:${sec}${isUtc ? "Z" : ""}`;
    }
    return `${year}-${month}-${day}T00:00:00Z`;
  }

  // Fallback to standard Date parsing if possible
  const parsed = Date.parse(val);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString();
  }
  return "";
}

/**
 * Extracts email from property values containing mailto: protocol
 */
function extractEmailFromMailto(val: string): string {
  if (!val) return "";
  const lower = val.toLowerCase();
  const mailtoIndex = lower.indexOf("mailto:");
  if (mailtoIndex !== -1) {
    const emailPart = val.substring(mailtoIndex + 7).trim();
    return sanitizeEmail(emailPart);
  }
  return sanitizeText(val, 200);
}

/**
 * Safe ICS Parser that processes lines with size guards and returns list of events
 */
export function parseIcsContent(
  icsContent: string,
  customLimits: Partial<ParseLimits> = {},
): { events: CalendarEvent[]; errors: string[]; stats: { linesProcessed: number } } {
  const limits = { ...DEFAULT_LIMITS, ...customLimits };
  const errors: string[] = [];
  const events: CalendarEvent[] = [];

  if (!icsContent) {
    return { events, errors: ["Empty ICS content provided"], stats: { linesProcessed: 0 } };
  }

  // Guard file size
  const byteLength = new Blob([icsContent]).size;
  if (byteLength > limits.maxFileSize) {
    return {
      events,
      errors: [
        `ICS content exceeds maximum allowed size of ${limits.maxFileSize / (1024 * 1024)}MB`,
      ],
      stats: { linesProcessed: 0 },
    };
  }

  // Step 1: Pre-process and unfold lines safely
  // iCalendar format folds lines by putting space/tab at starting of folded line
  const lines: string[] = [];
  let currentFoldedLine = "";

  // Use a custom generator-like iteration to avoid duplicating large arrays
  let startIndex = 0;
  let linesProcessed = 0;

  while (startIndex < icsContent.length) {
    let nextNewline = icsContent.indexOf("\n", startIndex);
    if (nextNewline === -1) {
      nextNewline = icsContent.length;
    }

    let line = icsContent.substring(startIndex, nextNewline);
    // Remove carriage return
    if (line.endsWith("\r")) {
      line = line.substring(0, line.length - 1);
    }

    startIndex = nextNewline + 1;
    linesProcessed++;

    // Guard line length
    if (line.length > limits.maxLineLength) {
      errors.push(
        `Line ${linesProcessed} exceeds maximum length (${limits.maxLineLength} chars). Truncated.`,
      );
      line = line.substring(0, limits.maxLineLength);
    }

    // Unfolding check: Starts with SPACE (0x20) or TAB (0x09)
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (currentFoldedLine.length < limits.maxPropertyLength) {
        currentFoldedLine += line.substring(1);
      }
    } else {
      if (currentFoldedLine) {
        lines.push(currentFoldedLine);
      }
      currentFoldedLine = line;
    }
  }

  if (currentFoldedLine) {
    lines.push(currentFoldedLine);
  }

  // Step 2: Parse Key-Value fields and build events
  let currentEvent: Partial<CalendarEvent> | null = null;
  let eventCount = 0;

  for (const line of lines) {
    if (!line || line.trim() === "") continue;

    // Split key and value on the first colon
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    let rawVal = line.substring(colonIndex + 1);

    // Guard property value length
    if (rawVal.length > limits.maxPropertyLength) {
      rawVal = rawVal.substring(0, limits.maxPropertyLength);
    }

    // Normalize Key (remove params, e.g. "DTSTART;VALUE=DATE" -> "DTSTART")
    const key = rawKey.split(";")[0].trim().toUpperCase();

    if (key === "BEGIN" && rawVal.trim().toUpperCase() === "VEVENT") {
      if (eventCount >= limits.maxEvents) {
        errors.push(
          `Maximum event extraction limit of ${limits.maxEvents} reached. Skipping remainder.`,
        );
        break;
      }
      currentEvent = {
        attendees: [],
        isSanitized: true,
      };
      eventCount++;
    } else if (key === "END" && rawVal.trim().toUpperCase() === "VEVENT" && currentEvent) {
      // Validate and build the final event
      const event: CalendarEvent = {
        id: currentEvent.id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: currentEvent.title || "Untitled Event",
        description: currentEvent.description || "",
        startDate: currentEvent.startDate || "",
        endDate: currentEvent.endDate || currentEvent.startDate || "",
        location: currentEvent.location || "",
        organizer: currentEvent.organizer || "Unknown",
        attendees: currentEvent.attendees || [],
        recurrence: currentEvent.recurrence || "",
        isSanitized: true,
      };
      events.push(event);
      currentEvent = null;
    } else if (currentEvent) {
      // We are inside a VEVENT block, process properties
      switch (key) {
        case "UID":
          currentEvent.id = sanitizeText(rawVal, 100);
          break;
        case "SUMMARY":
          // Decode escaped commas, semicolons, etc.
          currentEvent.title = sanitizeHtml(sanitizeText(decodeIcsText(rawVal), 200)).content;
          break;
        case "DESCRIPTION":
          currentEvent.description = sanitizeHtml(
            sanitizeText(decodeIcsText(rawVal), 10000),
          ).content;
          break;
        case "DTSTART":
          currentEvent.startDate = parseIcsDate(rawVal);
          break;
        case "DTEND":
          currentEvent.endDate = parseIcsDate(rawVal);
          break;
        case "LOCATION":
          currentEvent.location = sanitizeText(decodeIcsText(rawVal), 500);
          break;
        case "ORGANIZER":
          currentEvent.organizer = extractEmailFromMailto(rawVal);
          break;
        case "ATTENDEE":
          if (currentEvent.attendees && currentEvent.attendees.length < limits.maxAttendees) {
            currentEvent.attendees.push(extractEmailFromMailto(rawVal));
          }
          break;
        case "RRULE":
          currentEvent.recurrence = sanitizeText(rawVal, 200);
          break;
      }
    }
  }

  return {
    events,
    errors,
    stats: {
      linesProcessed,
    },
  };
}

/**
 * Decodes backslash-escaped characters in ICS values (e.g. \, \; \n)
 */
function decodeIcsText(val: string): string {
  if (!val) return "";
  return val
    .replace(/\\n/gi, "\n")
    .replace(/\\r/gi, "\r")
    .replace(/\\t/gi, "\t")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}
