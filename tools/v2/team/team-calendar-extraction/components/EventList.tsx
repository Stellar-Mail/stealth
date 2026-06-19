import React from "react";
import { CalendarEvent } from "../types";
import { escapeHtml } from "../services/sanitization";

interface EventListProps {
  events: CalendarEvent[];
}

export function EventList({ events }: EventListProps) {
  if (events.length === 0) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
        <span className="text-3xl block mb-2" role="img" aria-label="calendar">
          📅
        </span>
        <p className="text-sm text-muted-foreground font-medium">
          No events successfully extracted yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold text-foreground tracking-tight flex items-center gap-2">
        <span>Extracted Events ({events.length})</span>
        <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 px-2 py-0.5 rounded-full font-normal">
          Verified Safe
        </span>
      </h3>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="group relative border border-border/80 rounded-xl bg-card/30 p-5 hover:bg-card/70 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between"
          >
            <div>
              {/* Event Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h4 className="font-bold text-foreground group-hover:text-primary transition-colors text-base line-clamp-1">
                  {escapeHtml(event.title)}
                </h4>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                  {event.recurrence ? "Recurring" : "Single Event"}
                </span>
              </div>

              {/* Event Meta */}
              <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center">📅</span>
                  <span>
                    <strong>Start:</strong> {new Date(event.startDate).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center">🏁</span>
                  <span>
                    <strong>End:</strong> {new Date(event.endDate).toLocaleString()}
                  </span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <span className="w-4 text-center">📍</span>
                    <span className="truncate max-w-[280px]">{escapeHtml(event.location)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="w-4 text-center">👤</span>
                  <span className="truncate max-w-[280px]">
                    <strong>Host:</strong> {escapeHtml(event.organizer)}
                  </span>
                </div>
              </div>

              {/* Description */}
              {event.description && (
                <div className="mt-3 pt-3 border-t border-border/60">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Description:</p>
                  <p className="text-xs bg-muted/20 p-2.5 rounded-lg border border-border/30 whitespace-pre-wrap line-clamp-3 text-foreground/80 leading-relaxed font-mono">
                    {escapeHtml(event.description)}
                  </p>
                </div>
              )}
            </div>

            {/* Attendees list */}
            {event.attendees && event.attendees.length > 0 && (
              <div className="mt-4 pt-3 border-t border-border/60">
                <p className="text-xs text-muted-foreground font-medium mb-1.5">
                  Attendees ({event.attendees.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {event.attendees.map((attendee, index) => (
                    <span
                      key={index}
                      className="text-[10px] bg-secondary/80 text-secondary-foreground border border-border px-2 py-0.5 rounded-md truncate max-w-[120px]"
                      title={attendee}
                    >
                      {escapeHtml(attendee)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
