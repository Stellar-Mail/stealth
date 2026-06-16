import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { CalendarEvent, CalendarResponse, MailEvent } from "../types";
import "../styles.css";

export function EventMailCard({
  event,
  calendarEvent,
  onAdd,
  onOpen,
  onResponseChange,
  onReminderChange,
  calendarEvents = [],
  onDuplicate,
  onDelete,
}: {
  event: MailEvent;
  calendarEvent?: CalendarEvent | null;
  onAdd?: (event: MailEvent) => CalendarEvent | void;
  onOpen?: (eventId?: string) => void;
  onResponseChange?: (eventId: string, response: CalendarResponse) => void;
  onReminderChange?: (eventId: string, reminder: string) => void;
  calendarEvents?: CalendarEvent[];
  onDuplicate?: (eventId: string) => CalendarEvent | null;
  onDelete?: (eventId: string) => void;
}) {
  const [view, setView] = useState<"event" | "monthly">("event");
  const [addedEvent, setAddedEvent] = useState<CalendarEvent | null>(calendarEvent ?? null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [successAction, setSuccessAction] = useState<string | null>(null);

  const savedEvent = calendarEvent ?? addedEvent;
  const isPending = pendingAction !== null;

  // Helper to parse time to minutes for conflict detection
  const to24HourTime = (value: string) => {
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return "09:00";
    let hour = Number(match[1]);
    if (match[3]?.toUpperCase() === "PM" && hour < 12) hour += 12;
    if (match[3]?.toUpperCase() === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  };

  const parseTimeToMinutes = (t: string) => {
    const [h, m] = to24HourTime(t).split(":").map(Number);
    return h * 60 + m;
  };

  const eventDate = event.date ?? "2026-06-13";
  const eventStart = parseTimeToMinutes(event.time);
  const eventEnd = event.endTime ? parseTimeToMinutes(event.endTime) : eventStart + 60;

  // Detect conflict: overlaps with any other calendar event on the same day (excluding itself)
  const conflictEvent = calendarEvents.find((other) => {
    if (savedEvent && other.id === savedEvent.id) return false;
    if (other.date !== eventDate) return false;

    const otherStart = parseTimeToMinutes(other.time);
    const otherEnd = other.endTime ? parseTimeToMinutes(other.endTime) : otherStart + 60;

    return eventStart < otherEnd && otherStart < eventEnd;
  });

  // Detect duplicate: matches title, date, and time
  const isDuplicate = calendarEvents.some((other) => {
    if (savedEvent && other.id === savedEvent.id) return false;
    return (
      other.title === event.title &&
      other.date === eventDate &&
      to24HourTime(other.time) === to24HourTime(event.time)
    );
  });

  const handleAdd = async () => {
    setPendingAction("add");
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const saved = onAdd?.(event);
      if (saved) setAddedEvent(saved);
      setSuccessAction("add");
      setTimeout(() => setSuccessAction(null), 3000);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDuplicate = async () => {
    if (!savedEvent || !onDuplicate) return;
    setPendingAction("duplicate");
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      const duplicated = onDuplicate(savedEvent.id);
      if (duplicated) {
        setSuccessAction("duplicate");
        setTimeout(() => setSuccessAction(null), 3000);
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!savedEvent || !onDelete) return;
    setPendingAction("delete");
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      onDelete(savedEvent.id);
      setAddedEvent(null);
      setSuccessAction("delete");
      setTimeout(() => setSuccessAction(null), 3000);
    } finally {
      setPendingAction(null);
    }
  };

  const handleResponse = async (response: CalendarResponse) => {
    if (!savedEvent || !onResponseChange) return;
    setPendingAction(`rsvp-${response}`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      onResponseChange(savedEvent.id, response);
      setSuccessAction("rsvp");
      setTimeout(() => setSuccessAction(null), 2000);
    } finally {
      setPendingAction(null);
    }
  };

  const handleReminder = async (reminder: string) => {
    if (!savedEvent || !onReminderChange) return;
    setPendingAction("reminder");
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      onReminderChange(savedEvent.id, reminder);
      setSuccessAction("reminder");
      setTimeout(() => setSuccessAction(null), 2000);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="event-mail-hero relative mb-6 mt-7 min-h-[260px] max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.09] shadow-[0_24px_72px_-42px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.12)]"
    >
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
          <div className="flex items-center gap-2">
            {savedEvent ? (
              <>
                <label className="relative inline-flex items-center rounded-md border border-white/10 bg-black/40 pl-2 text-[9px]">
                  <Bell className="h-2.5 w-2.5" />
                  <select
                    disabled={isPending}
                    value={savedEvent.reminder}
                    onChange={(change) => handleReminder(change.target.value)}
                    className="h-7 appearance-none bg-transparent pl-1.5 pr-6 outline-none disabled:opacity-50"
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
                      disabled={isPending}
                      onClick={() => handleResponse(response)}
                      className={
                        savedEvent.response === response
                          ? "rounded px-2 py-1 text-[8px] capitalize text-black bg-white disabled:opacity-50"
                          : "rounded px-2 py-1 text-[8px] capitalize text-muted-foreground hover:text-foreground disabled:opacity-50"
                      }
                    >
                      {pendingAction === `rsvp-${response}` ? "..." : response}
                    </button>
                  ))}
                </div>
                {/* Extra Actions: Duplicate & Delete & Edit */}
                <div className="flex gap-1">
                  <button
                    disabled={isPending}
                    onClick={handleDuplicate}
                    title="Duplicate event"
                    className="rounded-md border border-white/10 bg-black/40 p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    disabled={isPending}
                    onClick={handleDelete}
                    title="Remove event"
                    className="rounded-md border border-white/10 bg-black/40 p-1.5 text-red-300 transition hover:bg-red-300/10 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                  <button
                    disabled={isPending}
                    onClick={() => onOpen?.(savedEvent.id)}
                    title="Edit event details"
                    className="rounded-md border border-white/10 bg-black/40 p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground disabled:opacity-50"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                {isDuplicate && (
                  <span className="rounded bg-sky-500/15 px-2 py-1 text-[8px] font-medium text-sky-300 border border-sky-500/20">
                    Duplicate found
                  </span>
                )}
                <button
                  disabled={isPending}
                  onClick={handleAdd}
                  className="mail-reader-meta inline-flex items-center gap-1 rounded-md bg-black/60 px-2.5 py-1.5 text-[9px] font-medium text-foreground transition hover:bg-black/75 disabled:opacity-50"
                >
                  <Plus className="h-2.5 w-2.5" />
                  {pendingAction === "add" ? "Adding..." : "Add to calendar"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Display Status Alerts (Success, Conflict, etc.) */}
        <AnimatePresence>
          {(successAction || conflictEvent) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-1.5 overflow-hidden"
            >
              {successAction && (
                <div className="flex items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/[0.05] p-2 text-[9px] text-emerald-200">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span>
                    {successAction === "add" && "Event added successfully!"}
                    {successAction === "duplicate" && "Event duplicated successfully!"}
                    {successAction === "delete" && "Event removed from calendar."}
                    {successAction === "rsvp" && "RSVP updated."}
                    {successAction === "reminder" && "Reminder updated."}
                  </span>
                </div>
              )}
              {!successAction && conflictEvent && (
                <div className="flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/[0.05] p-2 text-[9px] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                  <span>
                    Conflict: Overlaps with "{conflictEvent.title}" ({conflictEvent.time})
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
    </motion.div>
  );
}
