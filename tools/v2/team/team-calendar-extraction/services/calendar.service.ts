/**
 * Local Calendar Extraction Service
 *
 * Handles local calendar event data operations for the tool.
 * Do not wire this into the main app's calendar or mail integration.
 */

import type {
  CalendarEvent,
  CalendarExtractionRequest,
  ExtractionResult,
  ExtractionFilter,
  ExtractionStatus,
} from "../types";

class CalendarService {
  private events: Map<string, CalendarEvent> = new Map();
  private requests: Map<string, CalendarExtractionRequest> = new Map();
  private results: Map<string, ExtractionResult> = new Map();

  /**
   * Add or update a calendar event
   */
  addEvent(event: CalendarEvent): void {
    this.events.set(event.id, event);
  }

  /**
   * Get a specific event
   */
  getEvent(id: string): CalendarEvent | undefined {
    return this.events.get(id);
  }

  /**
   * Get all events
   */
  getAllEvents(): CalendarEvent[] {
    return Array.from(this.events.values());
  }

  /**
   * Get events by extraction request
   */
  getEventsByRequest(requestId: string): CalendarEvent[] {
    return Array.from(this.events.values()).filter((e) => e.sourceRef === requestId);
  }

  /**
   * Get events by status
   */
  getEventsByStatus(status: ExtractionStatus): CalendarEvent[] {
    return Array.from(this.events.values()).filter((e) => e.status === status);
  }

  /**
   * Get events by category
   */
  getEventsByCategory(category: string): CalendarEvent[] {
    return Array.from(this.events.values()).filter((e) => e.category === category);
  }

  /**
   * Get events by priority
   */
  getEventsByPriority(priority: string): CalendarEvent[] {
    return Array.from(this.events.values()).filter((e) => e.priority === priority);
  }

  /**
   * Get upcoming events (today or later)
   */
  getUpcomingEvents(): CalendarEvent[] {
    const now = new Date();
    return Array.from(this.events.values()).filter(
      (e) => e.startDate >= now && e.status === "extracted",
    );
  }

  /**
   * Filter events by various criteria
   */
  filterEvents(filter: ExtractionFilter): CalendarEvent[] {
    let filtered = Array.from(this.events.values());

    if (filter.dateFrom) {
      filtered = filtered.filter((e) => e.startDate >= filter.dateFrom!);
    }
    if (filter.dateTo) {
      filtered = filtered.filter((e) => e.startDate <= filter.dateTo!);
    }
    if (filter.categories && filter.categories.length > 0) {
      filtered = filtered.filter((e) => filter.categories!.includes(e.category));
    }
    if (filter.priorities && filter.priorities.length > 0) {
      filtered = filtered.filter((e) => filter.priorities!.includes(e.priority));
    }
    if (filter.status) {
      filtered = filtered.filter((e) => e.status === filter.status);
    }
    if (filter.attendees && filter.attendees.length > 0) {
      filtered = filtered.filter((e) => filter.attendees!.some((a) => e.attendees.includes(a)));
    }
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.tags.some((t) => t.toLowerCase().includes(query)),
      );
    }

    return filtered;
  }

  /**
   * Record an extraction request
   */
  addRequest(request: CalendarExtractionRequest): void {
    this.requests.set(request.id, request);
  }

  /**
   * Get a specific extraction request
   */
  getRequest(id: string): CalendarExtractionRequest | undefined {
    return this.requests.get(id);
  }

  /**
   * Get all extraction requests
   */
  getAllRequests(): CalendarExtractionRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Update extraction request status
   */
  updateRequestStatus(
    id: string,
    status: ExtractionStatus,
    eventCount?: number,
    extractedCount?: number,
    failedCount?: number,
  ): void {
    const request = this.requests.get(id);
    if (request) {
      request.status = status;
      if (eventCount !== undefined) request.eventCount = eventCount;
      if (extractedCount !== undefined) request.extractedCount = extractedCount;
      if (failedCount !== undefined) request.failedCount = failedCount;
    }
  }

  /**
   * Record an extraction result
   */
  addResult(result: ExtractionResult): void {
    this.results.set(result.requestId, result);
  }

  /**
   * Get extraction result for a request
   */
  getResult(requestId: string): ExtractionResult | undefined {
    return this.results.get(requestId);
  }

  /**
   * Get all results
   */
  getAllResults(): ExtractionResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Simulate extracting events from a source
   * This mimics what would be a real extraction process
   */
  async simulateExtraction(
    request: CalendarExtractionRequest,
    sourceEvents: CalendarEvent[],
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const extracted: CalendarEvent[] = [];
    let successes = 0;
    let failures = 0;

    // Simulate async extraction with some delay
    await new Promise((r) => setTimeout(r, 1500));

    for (const event of sourceEvents) {
      try {
        // Simulate extraction with ~90% success rate
        if (Math.random() > 0.1) {
          const extractedEvent: CalendarEvent = {
            ...event,
            status: "extracted",
            sourceRef: request.id,
            extractedAt: new Date(),
          };
          this.addEvent(extractedEvent);
          extracted.push(extractedEvent);
          successes++;
        } else {
          const failedEvent: CalendarEvent = {
            ...event,
            status: "failed",
            sourceRef: request.id,
            extractedAt: new Date(),
          };
          this.addEvent(failedEvent);
          extracted.push(failedEvent);
          failures++;
        }
      } catch {
        failures++;
      }
    }

    const result: ExtractionResult = {
      requestId: request.id,
      totalEvents: sourceEvents.length,
      successfulExtractions: successes,
      failedExtractions: failures,
      events: extracted,
      extractedAt: new Date(),
      duration: Date.now() - startTime,
    };

    // Update request status
    this.updateRequestStatus(
      request.id,
      failures > 0 && successes > 0 ? "extracted" : failures > 0 ? "failed" : "extracted",
      sourceEvents.length,
      successes,
      failures,
    );

    this.addResult(result);

    return result;
  }

  /**
   * Clear all local data
   */
  clear(): void {
    this.events.clear();
    this.requests.clear();
    this.results.clear();
  }
}

// Singleton instance
export const calendarService = new CalendarService();
