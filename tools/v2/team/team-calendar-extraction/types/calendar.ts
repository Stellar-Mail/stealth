/**
 * Team Calendar Extraction Types
 *
 * Local type definitions for the Team Calendar Extraction tool.
 * Do not wire these into the main app's mail or calendar integration.
 */

export type ExtractionStatus = "pending" | "extracted" | "failed" | "skipped";
export type EventPriority = "low" | "normal" | "high" | "urgent";
export type EventCategory = "meeting" | "deadline" | "reminder" | "milestone" | "personal";
export type ExtractionSource = "email" | "calendar_link" | "manual" | "attachment";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  location?: string;
  attendees: string[];
  organizer: string;
  priority: EventPriority;
  category: EventCategory;
  status: ExtractionStatus;
  source: ExtractionSource;
  sourceRef?: string;
  tags: string[];
  extractedAt: Date;
  notes?: string;
}

export interface CalendarExtractionRequest {
  id: string;
  title: string;
  source: ExtractionSource;
  sourceRef?: string;
  requestedBy: string;
  requestedAt: Date;
  status: ExtractionStatus;
  events: CalendarEvent[];
  eventCount: number;
  extractedCount: number;
  failedCount: number;
  notes?: string;
}

export interface ExtractionResult {
  requestId: string;
  totalEvents: number;
  successfulExtractions: number;
  failedExtractions: number;
  events: CalendarEvent[];
  extractedAt: Date;
  duration: number;
}

export interface ExtractionFilter {
  dateFrom?: Date;
  dateTo?: Date;
  categories?: EventCategory[];
  priorities?: EventPriority[];
  status?: ExtractionStatus;
  searchQuery?: string;
  attendees?: string[];
}
