import React, { useState, useCallback, useEffect } from "react";
import type {
  CalendarEvent,
  CalendarExtractionRequest,
  ExtractionSource,
  ExtractionResult,
} from "../types";
import { calendarService } from "../services";
import {
  EventList,
  ExtractionForm,
  EmptyState,
  LoadingState,
  ErrorState,
  SuccessState,
} from "./index";

/**
 * TeamCalendarExtractionTool
 *
 * Main container component for the Team Calendar Extraction tool.
 * This is a self-contained, locally-scoped workflow for extracting
 * calendar events from various sources.
 *
 * States:
 * - list: Showing event list
 * - details: Showing event details
 * - extracting: Showing extraction form
 * - loading: Loading data
 * - error: Error state
 * - success: Success confirmation
 *
 * Accessibility:
 * - Focus management between views
 * - Keyboard shortcuts documented
 * - Screen reader friendly state announcements
 * - Proper heading hierarchy
 */

type ViewState = "list" | "details" | "extracting" | "loading" | "error" | "success";

interface TeamCalendarExtractionToolProps {
  events: CalendarEvent[];
  extractionRequests?: CalendarExtractionRequest[];
  onExtract?: (request: CalendarExtractionRequest) => Promise<ExtractionResult>;
  isLoading?: boolean;
  error?: string | null;
}

export function TeamCalendarExtractionTool({
  events,
  extractionRequests: initialRequests = [],
  onExtract,
  isLoading = false,
  error: initialError = null,
}: TeamCalendarExtractionToolProps) {
  const [viewState, setViewState] = useState<ViewState>(isLoading ? "loading" : "list");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [sortBy, setSortBy] = useState<"date" | "priority" | "category">("date");
  const [extractionRequests, setExtractionRequests] =
    useState<CalendarExtractionRequest[]>(initialRequests);
  const [lastExtractionResult, setLastExtractionResult] = useState<ExtractionResult | null>(null);
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(events);

  useEffect(() => {
    if (isLoading) {
      setViewState("loading");
    } else if (initialError) {
      setError(initialError);
      setViewState("error");
    }
  }, [isLoading, initialError]);

  // Update local events when props change
  useEffect(() => {
    setLocalEvents(events);
  }, [events]);

  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setViewState("details");
    // Announce to screen readers
    const announcement = `Viewing event: ${event.title}`;
    const ariaLive = document.createElement("div");
    ariaLive.setAttribute("role", "status");
    ariaLive.setAttribute("aria-live", "polite");
    ariaLive.className = "sr-only";
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);
    setTimeout(() => ariaLive.remove(), 1000);
  }, []);

  const handleNewExtraction = useCallback(() => {
    if (localEvents.length > 0) {
      setSelectedEvent(localEvents[0]);
    }
    setViewState("extracting");
    setError(null);
  }, [localEvents]);

  const handleInitiateExtraction = useCallback(
    async (source: ExtractionSource) => {
      if (!selectedEvent) return;

      try {
        setViewState("loading");

        const request: CalendarExtractionRequest = {
          id: `extraction-${Date.now()}`,
          title: `Extract from: ${source}`,
          source,
          sourceRef: undefined,
          requestedBy: "current-user",
          requestedAt: new Date(),
          status: "pending",
          events: [selectedEvent],
          eventCount: 1,
          extractedCount: 0,
          failedCount: 0,
        };

        let result: ExtractionResult;

        if (onExtract) {
          result = await onExtract(request);
        } else {
          // Use simulated extraction by default
          const sourceEvents = [selectedEvent];
          calendarService.addRequest(request);
          result = await calendarService.simulateExtraction(request, sourceEvents);
        }

        setLastExtractionResult(result);
        setExtractionRequests((prev) => [...prev, request]);

        // Update local events with extracted ones
        if (result.events.length > 0) {
          setLocalEvents((prev) => {
            const newEvents = result.events.filter((re) => !prev.find((pe) => pe.id === re.id));
            return [...newEvents, ...prev];
          });
        }

        setViewState("success");

        // Auto-dismiss after 4 seconds
        setTimeout(() => {
          setViewState("list");
          setSelectedEvent(null);
          setLastExtractionResult(null);
        }, 4000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Extraction failed");
        setViewState("error");
      }
    },
    [selectedEvent, onExtract],
  );

  const handleViewExtractionResult = useCallback(() => {
    if (lastExtractionResult) {
      setViewState("success");
    }
  }, [lastExtractionResult]);

  const handleBackToList = useCallback(() => {
    setViewState("list");
    setSelectedEvent(null);
    setError(null);
    setLastExtractionResult(null);
  }, []);

  const handleRetry = useCallback(() => {
    if (error) {
      setError(null);
      setViewState("list");
    }
  }, [error]);

  const sortedEvents = [...localEvents].sort((a, b) => {
    switch (sortBy) {
      case "priority": {
        const priorityOrder = {
          urgent: 0,
          high: 1,
          normal: 2,
          low: 3,
        } as const;
        return (
          (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2) -
          (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2)
        );
      }
      case "category": {
        return a.category.localeCompare(b.category);
      }
      case "date":
      default:
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    }
  });

  const extractedCount = localEvents.filter((e) => e.status === "extracted").length;
  const pendingCount = localEvents.filter((e) => e.status === "pending").length;
  const failedCount = localEvents.filter((e) => e.status === "failed").length;

  return (
    <div className="w-full min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-muted/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Team Calendar Extraction</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Extract, view, and manage calendar events from team communications
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {viewState === "loading" && <LoadingState message="Processing extraction..." />}

        {viewState === "error" && error && (
          <ErrorState
            title="Extraction Failed"
            details={error}
            action={
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try Again
              </button>
            }
          />
        )}

        {viewState === "list" && localEvents.length === 0 && (
          <EmptyState
            icon="📅"
            title="No Calendar Events"
            description="No calendar events available. Start a new extraction to find events from your team communications."
            action={
              <button
                onClick={handleNewExtraction}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Start New Extraction
              </button>
            }
          />
        )}

        {viewState === "list" && localEvents.length > 0 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">Events ({localEvents.length})</h2>
                <div className="flex gap-3 text-sm">
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {extractedCount} extracted
                  </span>
                  {pendingCount > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {pendingCount} pending
                    </span>
                  )}
                  {failedCount > 0 && (
                    <span className="text-destructive">{failedCount} failed</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {extractionRequests.length > 0 && (
                  <button
                    onClick={handleViewExtractionResult}
                    className="px-3 py-1.5 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    aria-label="View recent extraction results"
                  >
                    History
                  </button>
                )}
                <button
                  onClick={handleNewExtraction}
                  className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  aria-label="Start new calendar extraction"
                >
                  + New Extraction
                </button>
              </div>
            </div>

            <EventList
              events={sortedEvents}
              onSelectEvent={handleSelectEvent}
              selectedEventId={selectedEvent?.id}
              sortBy={sortBy}
              onSort={setSortBy}
            />
          </div>
        )}

        {viewState === "details" && selectedEvent && (
          <div className="space-y-4">
            <button
              onClick={handleBackToList}
              className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
              aria-label="Back to event list"
            >
              ← Back to List
            </button>

            {/* Event Detail Card */}
            <div className="rounded-lg border border-border bg-background p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">{selectedEvent.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{selectedEvent.description}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                    selectedEvent.status === "extracted"
                      ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100"
                      : selectedEvent.status === "pending"
                        ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100"
                        : "bg-destructive/10 text-destructive"
                  }`}
                  role="status"
                  aria-label={`Status: ${selectedEvent.status}`}
                >
                  {selectedEvent.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <span className="ml-2 font-medium">
                      {new Date(selectedEvent.startDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {selectedEvent.allDay
                        ? " (All day)"
                        : selectedEvent.endDate
                          ? ` · ${new Date(selectedEvent.endDate).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : ""}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <span className="ml-2 font-medium capitalize">{selectedEvent.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Priority:</span>
                    <span className="ml-2 font-medium capitalize">{selectedEvent.priority}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <span className="ml-2 font-medium capitalize">
                      {selectedEvent.source.replace("_", " ")}
                    </span>
                  </div>
                  {selectedEvent.location && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <span className="ml-2 font-medium">{selectedEvent.location}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Organizer:</span>
                    <span className="ml-2 font-medium">{selectedEvent.organizer}</span>
                  </div>
                </div>
              </div>

              {/* Attendees */}
              {selectedEvent.attendees.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    Attendees ({selectedEvent.attendees.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.attendees.map((attendee) => (
                      <span
                        key={attendee}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground"
                      >
                        {attendee}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedEvent.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEvent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={handleNewExtraction}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  aria-label="Start extraction from this event"
                >
                  Extract Events
                </button>
                <button
                  onClick={handleBackToList}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-input bg-background hover:bg-accent text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                >
                  Back to List
                </button>
              </div>
            </div>
          </div>
        )}

        {viewState === "extracting" && selectedEvent && (
          <div className="space-y-4">
            <button
              onClick={handleBackToList}
              className="text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
              aria-label="Back to event list"
            >
              ← Back to List
            </button>
            <ExtractionForm
              event={selectedEvent}
              onInitiateExtraction={async (source) => {
                await handleInitiateExtraction(source);
              }}
              onCancel={handleBackToList}
              onRetry={handleRetry}
              isLoading={viewState === "loading"}
              error={error}
            />
          </div>
        )}

        {viewState === "success" && lastExtractionResult && (
          <SuccessState
            icon="✅"
            title="Extraction Complete"
            details={`Successfully extracted ${lastExtractionResult.successfulExtractions} of ${lastExtractionResult.totalEvents} events${lastExtractionResult.failedExtractions > 0 ? ` (${lastExtractionResult.failedExtractions} failed)` : ""}. Returning to event list...`}
            action={
              <button
                onClick={handleBackToList}
                className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View Events
              </button>
            }
          />
        )}

        {viewState === "success" && !lastExtractionResult && (
          <SuccessState
            icon="✅"
            title="Extraction Complete"
            details="Calendar events have been processed. Returning to event list..."
          />
        )}
      </main>

      {/* Extraction History Section (conditional) */}
      {viewState === "details" && extractionRequests.length > 0 && (
        <aside className="max-w-6xl mx-auto px-4 pb-8" aria-label="Extraction history">
          <details className="rounded-lg border border-border bg-muted/20">
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-foreground hover:bg-muted/50 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              Extraction History ({extractionRequests.length})
            </summary>
            <div className="px-4 pb-4 space-y-2">
              {extractionRequests
                .slice()
                .reverse()
                .map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-3 rounded-md bg-background border border-border text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{req.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {req.source.replace("_", " ")} ·{" "}
                        {new Date(req.requestedAt).toLocaleDateString()}
                        {req.extractedCount > 0 && ` · ${req.extractedCount} extracted`}
                        {req.failedCount > 0 && ` · ${req.failedCount} failed`}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        req.status === "extracted"
                          ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-100"
                          : req.status === "failed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        </aside>
      )}

      {/* Accessibility Announcements Region */}
      <div role="region" aria-live="polite" aria-label="Status messages" className="sr-only" />
    </div>
  );
}

export type { TeamCalendarExtractionToolProps };
