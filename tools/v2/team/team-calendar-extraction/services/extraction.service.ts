import { CalendarEvent, EmailData, ExtractionStats, ValidationError } from "../types";
import { parseIcsContent } from "./ics-parser";
import { sanitizeHtml, sanitizeText, sanitizeEmail } from "./sanitization";
import { validateCalendarEvent } from "./validation";

/**
 * Limit parameters to avoid DoS/ReDoS
 */
const MAX_EMAIL_BODY_LENGTH = 100000; // 100KB max body for scanning
const MAX_EMAILS_PER_BATCH = 50;

/**
 * Safe text extraction pattern for meeting details.
 * Kept simple and flat to avoid ReDoS.
 */
const MEETING_INDICATOR_REGEX =
  /\b(meeting|sync|call|review|standup|workshop|discussion|calendar|zoom|meet\.google)\b/i;

/**
 * Extract calendar events from email text/HTML content safely
 */
export function extractEventFromEmailText(email: EmailData): CalendarEvent | null {
  if (!email || !email.body) return null;

  // Guard against massive email bodies
  const bodyToScan =
    email.body.length > MAX_EMAIL_BODY_LENGTH
      ? email.body.substring(0, MAX_EMAIL_BODY_LENGTH)
      : email.body;

  // Quick scanner check before executing complex operations
  if (!MEETING_INDICATOR_REGEX.test(email.subject) && !MEETING_INDICATOR_REGEX.test(bodyToScan)) {
    return null; // Not calendar/meeting related
  }

  // Sanitize subject and body
  const cleanSubject = sanitizeHtml(sanitizeText(email.subject, 200)).content;
  const { content: cleanBody } = sanitizeHtml(bodyToScan);

  // Extract date indicators safely (simple regex without overlapping groups)
  // Look for patterns like YYYY-MM-DD or DD/MM/YYYY
  const dateRegex = /\b\d{4}[-/]\d{2}[-/]\d{2}\b/g;
  const datesFound = cleanBody.match(dateRegex);

  let startDate = new Date().toISOString(); // Default to now
  if (datesFound && datesFound.length > 0) {
    const timestamp = Date.parse(datesFound[0]);
    if (!isNaN(timestamp)) {
      startDate = new Date(timestamp).toISOString();
    }
  }

  // Set end date to 1 hour later
  const startMs = new Date(startDate).getTime();
  const endDate = new Date(startMs + 60 * 60 * 1000).toISOString();

  const event: CalendarEvent = {
    id: `extracted_email_${email.id}`,
    title: cleanSubject || "Extracted Team Sync",
    description:
      `Extracted from email. Sender: ${sanitizeEmail(email.from)}.\n\n` +
      sanitizeText(cleanBody.replace(/<[^>]*>/g, ""), 500),
    startDate,
    endDate,
    location: "Online Link / Email Thread",
    organizer: sanitizeEmail(email.from),
    attendees: [sanitizeEmail(email.from), ...email.to.map((t) => sanitizeEmail(t))].slice(0, 10),
    isSanitized: true,
  };

  // Validate the event
  const validationResult = validateCalendarEvent(event);
  if (!validationResult.valid) {
    // Attempt recovery or return null
    return null;
  }

  return event;
}

/**
 * Orchestrator service to extract calendar events from a batch of emails and attachments
 */
export function processTeamEmails(
  emails: EmailData[],
  onProgress?: (progress: number) => void,
): {
  events: CalendarEvent[];
  stats: ExtractionStats;
  errors: { emailId: string; message: string }[];
  sanitizationLog: string[];
} {
  const startTime = Date.now();
  const events: CalendarEvent[] = [];
  const errors: { emailId: string; message: string }[] = [];
  const sanitizationLog: string[] = [];

  let bytesProcessed = 0;
  const sanitizationActions = 0;
  let eventsFound = 0;

  // Limit processing batch size
  const batch = emails.slice(0, MAX_EMAILS_PER_BATCH);
  if (emails.length > MAX_EMAILS_PER_BATCH) {
    sanitizationLog.push(
      `Warning: Input list truncated from ${emails.length} to batch limit of ${MAX_EMAILS_PER_BATCH} emails.`,
    );
  }

  batch.forEach((email, index) => {
    try {
      const emailBytes = new Blob([email.body || "", email.subject || ""]).size;
      bytesProcessed += emailBytes;

      // 1. Check for ICS attachments
      if (email.hasAttachments && email.attachments) {
        email.attachments.forEach((attachment) => {
          if (attachment.filename.endsWith(".ics") && attachment.content) {
            sanitizationLog.push(
              `Processing .ics attachment "${attachment.filename}" from email ${email.id}`,
            );

            // Decrypted base64 or plain string
            const rawIcs = attachment.content;
            bytesProcessed += new Blob([rawIcs]).size;

            const parseResult = parseIcsContent(rawIcs);
            eventsFound += parseResult.events.length;

            parseResult.errors.forEach((err) => {
              errors.push({
                emailId: email.id,
                message: `Attachment error in ${attachment.filename}: ${err}`,
              });
            });

            parseResult.events.forEach((evt) => {
              const validation = validateCalendarEvent(evt);
              if (validation.valid) {
                events.push(evt);
              } else {
                errors.push({
                  emailId: email.id,
                  message: `Invalid parsed event "${evt.title}": ${validation.errors.map((e) => e.message).join(", ")}`,
                });
              }
            });
          }
        });
      }

      // 2. Perform text extraction scan on the body
      const textEvent = extractEventFromEmailText(email);
      if (textEvent) {
        eventsFound++;
        events.push(textEvent);
        sanitizationLog.push(
          `Extracted event from text of email ${email.id} ("${textEvent.title}")`,
        );
      }

      if (onProgress) {
        onProgress(Math.round(((index + 1) / batch.length) * 100));
      }
    } catch (err) {
      errors.push({
        emailId: email.id,
        message: err instanceof Error ? err.message : "Unknown error during parsing",
      });
    }
  });

  const timeElapsedMs = Date.now() - startTime;

  return {
    events,
    stats: {
      bytesProcessed,
      timeElapsedMs,
      eventsFound,
      eventsExtracted: events.length,
      sanitizationActions,
    },
    errors,
    sanitizationLog,
  };
}
