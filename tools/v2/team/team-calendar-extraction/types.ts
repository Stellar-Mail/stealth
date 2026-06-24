/** Severity of a confidence score when parsing a calendar event from email. */
export type ExtractionConfidence = "high" | "medium" | "low";

/** Status of a calendar event that has been extracted from an email thread. */
export type EventStatus = "confirmed" | "tentative" | "cancelled";

/** A single attendee reference extracted from an email. */
export interface EventAttendee {
  /** Email address of the attendee. */
  email: string;
  /** Display name if parseable from the email body or headers. */
  name?: string;
  /** Whether this attendee is the one who organised the event. */
  organiser: boolean;
}

/** A calendar event extracted from a source email message. */
export interface CalendarEvent {
  /** Stable identifier for the extracted event. */
  id: string;
  /** Human-readable title derived from the email subject or body. */
  title: string;
  /** ISO 8601 date-time string for the start of the event. */
  startAt: string;
  /** ISO 8601 date-time string for the end of the event.  May equal startAt for all-day events. */
  endAt: string;
  /** Free-text location string if found in the email. */
  location?: string;
  /** Brief description parsed from the email body. */
  description?: string;
  /** Attendees inferred from To/CC headers and body mentions. */
  attendees: EventAttendee[];
  /** Current status of the event. */
  status: EventStatus;
  /** How confident the extractor is that this is a real event. */
  confidence: ExtractionConfidence;
  /** ID of the source email message this event was extracted from. */
  sourceMessageId: string;
}

/** A raw email message that is the input to the extraction pipeline. */
export interface SourceMessage {
  /** Stable identifier matching CalendarEvent.sourceMessageId. */
  id: string;
  /** Sender address. */
  from: string;
  /** Recipient address list (To field). */
  to: string[];
  /** CC address list. */
  cc: string[];
  /** Email subject line. */
  subject: string;
  /** ISO 8601 date-time the message was received. */
  receivedAt: string;
  /** Plain-text body of the message. */
  body: string;
  /** Whether the message body contains an iCalendar (.ics) attachment hint. */
  hasIcsAttachment: boolean;
}

/** Top-level shape of the fixture JSON file. */
export interface CalendarExtractionFixture {
  tool: "team-calendar-extraction";
  version: number;
  sourceMessages: SourceMessage[];
  expectedEvents: CalendarEvent[];
}
