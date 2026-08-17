import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  MapPin,
  Plus,
} from "lucide-react";
import { useState } from "react";
import type { CalendarEvent, CalendarResponse, MailEvent } from "../types";
import "../styles.css";

export function EventMailCard({
  event,
  calendarEvent,
  onAdd,
  onOpen,
  onResponseChange,
  onReminderChange,
}: {
  event: MailEvent;
  calendarEvent?: CalendarEvent | null;
  onAdd?: (event: MailEvent) => CalendarEvent | void;
  onOpen?: (eventId?: string) => void;
  onResponseChange?: (eventId: string, response: CalendarResponse) => void;
  onReminderChange?: (eventId: string, reminder: string) => void;
}) {
  const [view, setView] = useState<"event" | "monthly">("event");
  const [addedEvent, setAddedEvent] = useState<CalendarEvent | null>(calendarEvent ?? null);
  const savedEvent = calendarEvent ?? addedEvent;

  const addEvent = () => {
    const saved = onAdd?.(event);
    if (saved) setAddedEvent(saved);
  };

  return (
    <div className="event-mail-hero relative mb-6 mt-7 min-h-[260px] max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_24px_72px_-42px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="event-mail-ridges" />
      <div className="event-calendar-card relative z-10 m-3.5 w-[calc(100%-1.75rem)] rounded-[20px] border border-white/[0.13] p-3.5 text-foreground shadow-[0_28px_70px_-36px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.16)]">
        <div className="mail-reader-meta flex items-center gap-2 text-[10px] text-muted-foreground">
          <button
            onClick={() => setView("event")}
            className={
              view === "event"
                ? "rounded-md border border-white/[0.13] bg-white/70 px-4 py-1.5 font-medium text-background"
                : "rounded-md px-3 py-1.5 transition hover:bg-white/[0.06] hover:text-foreground"
            }
          >
            {event.cadence}
          </button>
          <button
            onClick={() => setView("monthly")}
            className={
              view === "monthly"
                ? "rounded-md border border-white/[0.13] bg-white/70 px-3 py-1.5 font-medium text-background"
                : "rounded-md px-3 py-1.5 transition hover:bg-white/[0.06] hover:text-foreground"
            }
          >
            Monthly
          </button>
          <button
            onClick={() => onOpen?.(savedEvent?.id)}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Open calendar
          </button>
        </div>

        {view === "event" ? (
          <>
            <div className="mt-4 flex items-end justify-between">
              <div className="mail-reader-title text-[32px] font-medium leading-none text-foreground/90">
                {event.month}
              </div>
              <div className="mail-reader-title text-[32px] font-medium leading-none text-foreground/90">
                {event.day}
              </div>
            </div>

            <div className="mt-2.5 text-xs font-semibold text-foreground/90">{event.title}</div>

            <div className="mail-reader-meta mt-3.5 grid grid-cols-7 gap-1.5 text-center">
              {event.days.map((day) => (
                <div key={`${day.label}-${day.date}`} className="space-y-1">
                  <div className="text-[9px] uppercase text-muted-foreground/75">{day.label}</div>
                  <div
                    className={
                      day.active
                        ? "mx-auto grid h-4.5 w-4.5 place-items-center rounded-md bg-white/70 text-[9px] font-semibold text-background shadow-[0_0_18px_rgba(255,255,255,0.16)]"
                        : "text-[9px] font-medium text-foreground/74"
                    }
                  >
                    {day.date}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, index) => {
              const date = index + 1;
              const active = String(date) === event.day;
              return (
                <button
                  key={date}
                  onClick={() => active && onOpen?.(savedEvent?.id)}
                  className={
                    active
                      ? "grid h-7 place-items-center rounded-md bg-white text-[10px] font-semibold text-black"
                      : "grid h-7 place-items-center rounded-md text-[10px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                  }
                >
                  {date}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <div className="mail-reader-meta min-w-0 flex-1 space-y-0.5 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock3 className="h-2.5 w-2.5" />
              <span>
                {event.time}
                {event.endTime ? ` - ${event.endTime}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              <span className="truncate">{event.location}</span>
            </div>
          </div>
          {savedEvent ? (
            <>
              <label className="relative inline-flex items-center rounded-md border border-white/10 bg-black/40 pl-2 text-[9px]">
                <Bell className="h-2.5 w-2.5" />
                <select
                  value={savedEvent.reminder}
                  onChange={(change) => onReminderChange?.(savedEvent.id, change.target.value)}
                  className="h-7 appearance-none bg-transparent pl-1.5 pr-6 outline-none"
                >
                  {["None", "10 minutes", "15 minutes", "30 minutes", "1 hour"].map((reminder) => (
                    <option key={reminder} value={reminder} className="bg-background">
                      {reminder}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 h-2.5 w-2.5" />
              </label>
              <div className="flex rounded-md border border-white/10 bg-black/40 p-0.5">
                {(["going", "maybe", "declined"] as const).map((response) => (
                  <button
                    key={response}
                    onClick={() => onResponseChange?.(savedEvent.id, response)}
                    className={
                      savedEvent.response === response
                        ? "rounded px-2 py-1 text-[8px] capitalize text-black bg-white"
                        : "rounded px-2 py-1 text-[8px] capitalize text-muted-foreground hover:text-foreground"
                    }
                  >
                    {response}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={addEvent}
              className="mail-reader-meta inline-flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-1.5 text-[9px] font-medium text-foreground transition hover:bg-black/75"
            >
              <Plus className="h-2.5 w-2.5" />
              Add to calendar
            </button>
          )}
        </div>
      </div>

      <div className="mail-reader-meta relative z-20 mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className="rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 backdrop-blur-xl">
          {savedEvent ? (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3 w-3 text-emerald-300" /> Added to calendar
            </span>
          ) : (
            "Upcoming event"
          )}
        </span>
        <button
          onClick={() => {
            if (event.meetingUrl) window.open(event.meetingUrl, "_blank", "noopener,noreferrer");
            else onOpen?.(savedEvent?.id);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 backdrop-blur-xl transition hover:bg-white/[0.08] hover:text-foreground"
        >
          {event.note}
          <ExternalLink className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
