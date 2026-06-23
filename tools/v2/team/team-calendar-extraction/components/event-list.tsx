import React, { useRef, useCallback } from "react";
import type { CalendarEvent, EventCategory } from "../types";

/**
 * EventList Component
 *
 * Accessible list of extracted calendar events.
 *
 * Accessibility features:
 * - Semantic list structure with proper headings
 * - Keyboard navigation with arrow keys and Enter
 * - Event selection with focus management
 * - Status badges with aria-label for color-coded information
 * - Category and priority indicators with text labels
 * - Responsive with proper contrast
 * - Focus indicators on interactive elements
 */

interface EventListProps {
  events: CalendarEvent[];
  onSelectEvent: (event: CalendarEvent) => void;
  selectedEventId?: string;
  isLoading?: boolean;
  sortBy?: "date" | "priority" | "category";
  onSort?: (sortBy: "date" | "priority" | "category") => void;
}

const STATUS_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-800 dark:text-yellow-100" },
  extracted: {
    bg: "bg-emerald-100 dark:bg-emerald-900",
    text: "text-emerald-800 dark:text-emerald-100",
  },
  failed: { bg: "bg-destructive/10", text: "text-destructive" },
  skipped: { bg: "bg-gray-100 dark:bg-gray-900", text: "text-gray-800 dark:text-gray-100" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-destructive",
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  meeting: "Meeting",
  deadline: "Deadline",
  reminder: "Reminder",
  milestone: "Milestone",
  personal: "Personal",
};

function formatDateShort(date: Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "Invalid date";
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function EventList({
  events,
  onSelectEvent,
  selectedEventId,
  isLoading,
  sortBy,
  onSort,
}: EventListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, event: CalendarEvent) => {
      const items = listRef.current?.querySelectorAll("[data-event-id]");
      if (!items) return;

      const currentIndex = Array.from(items).findIndex(
        (item) => item.getAttribute("data-event-id") === event.id,
      );

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            const nextItem = items[currentIndex + 1] as HTMLElement;
            nextItem.focus();
            const nextId = nextItem.getAttribute("data-event-id");
            if (nextId) {
              const nextEvent = events.find((ev) => ev.id === nextId);
              if (nextEvent) onSelectEvent(nextEvent);
            }
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            const prevItem = items[currentIndex - 1] as HTMLElement;
            prevItem.focus();
            const prevId = prevItem.getAttribute("data-event-id");
            if (prevId) {
              const prevEvent = events.find((ev) => ev.id === prevId);
              if (prevEvent) onSelectEvent(prevEvent);
            }
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          onSelectEvent(event);
          break;
      }
    },
    [events, onSelectEvent],
  );

  const handleSortClick = (newSort: "date" | "priority" | "category") => {
    onSort?.(newSort);
  };

  return (
    <div className="w-full" ref={listRef}>
      {/* Sort controls */}
      <div className="flex items-center gap-4 mb-4" role="toolbar" aria-label="Sort events">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <div className="flex gap-1" role="group" aria-label="Sort order">
          {(["date", "priority", "category"] as const).map((option) => (
            <button
              key={option}
              onClick={() => handleSortClick(option)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                sortBy === option
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              aria-pressed={sortBy === option}
              aria-label={`Sort by ${option}`}
            >
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Event count */}
      <div className="text-sm text-muted-foreground mb-4" aria-live="polite">
        Showing {events.length} event{events.length !== 1 ? "s" : ""}
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground" role="status">
          No events match the current filters.
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Calendar events">
          {events.map((event) => {
            const isSelected = selectedEventId === event.id;
            const statusColors = STATUS_BADGE_COLORS[event.status];
            const priorityColor = PRIORITY_COLORS[event.priority];

            return (
              <div
                key={event.id}
                ref={isSelected ? selectedItemRef : undefined}
                data-event-id={event.id}
                onKeyDown={(e) => handleKeyDown(e, event)}
                onClick={() => onSelectEvent(event)}
                tabIndex={0}
                role="listitem"
                className={`relative rounded-lg border p-4 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  isSelected
                    ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
                    : "bg-background border-border hover:bg-muted/50 active:bg-muted"
                }`}
                aria-selected={isSelected}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {event.title}
                      </h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                        role="status"
                        aria-label={`Status: ${event.status}`}
                      >
                        {event.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {event.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span
                        className="flex items-center gap-1"
                        aria-label={`Date: ${new Date(event.startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
                      >
                        <span aria-hidden="true">📅</span>
                        {formatDateShort(event.startDate)}
                        {event.endDate && !event.allDay
                          ? ` · ${new Date(event.endDate).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                          : event.allDay
                            ? " · All day"
                            : ""}
                      </span>
                      <span
                        className={`flex items-center gap-1 capitalize ${priorityColor}`}
                        aria-label={`Priority: ${event.priority}`}
                      >
                        <span aria-hidden="true">⚑</span>
                        {event.priority}
                      </span>
                      <span
                        className="flex items-center gap-1"
                        aria-label={`Category: ${CATEGORY_LABELS[event.category]}`}
                      >
                        <span aria-hidden="true">○</span>
                        {CATEGORY_LABELS[event.category]}
                      </span>
                      {event.location && (
                        <span
                          className="flex items-center gap-1 truncate max-w-[200px]"
                          aria-label={`Location: ${event.location}`}
                        >
                          <span aria-hidden="true">📍</span>
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: View button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectEvent(event);
                    }}
                    className="shrink-0 px-3 py-1.5 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label={`View details for ${event.title}`}
                  >
                    View
                  </button>
                </div>

                {/* Tags */}
                {event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-border">
                    {event.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Attendees */}
                {event.attendees.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Attendees:</span>
                    {event.attendees.slice(0, 3).join(", ")}
                    {event.attendees.length > 3 && <span>+{event.attendees.length - 3} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export type { EventListProps };
