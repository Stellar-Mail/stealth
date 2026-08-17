/**
 * Types for Team Calendar Extraction
 */

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO String
  endDate: string; // ISO String
  location?: string;
  organizer: string;
  attendees: string[];
  recurrence?: string;
  isSanitized: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ParseLimits {
  maxFileSize: number; // in bytes
  maxLineLength: number; // in characters
  maxEvents: number;
  maxPropertyLength: number;
  maxAttendees: number;
}

export interface ExtractionStats {
  bytesProcessed: number;
  timeElapsedMs: number;
  eventsFound: number;
  eventsExtracted: number;
  sanitizationActions: number;
}

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  to: string[];
  body: string;
  hasAttachments: boolean;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    sizeBytes: number;
    content?: string; // Base64 or plain string
  }>;
}
