import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { addDays, addMonths, format, isSameDay, parseISO, subMonths } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { calendarColors } from "../data";
import { getAppToday } from "../dateUtils";
import type {
  CalendarDefinition,
  CalendarEvent,
  CalendarEventDraft,
  CalendarResponse,
} from "../types";

type CalendarWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  calendars: CalendarDefinition[];
  events: CalendarEvent[];
  initialEventId?: string | null;
  createRequest?: number;
  onSaveEvent: (event: CalendarEventDraft) => CalendarEvent;
  onDeleteEvent: (id: string) => void;
  onDuplicateEvent: (id: string) => CalendarEvent | null;
  onResponseChange: (id: string, response: CalendarResponse) => void;
  onReminderChange: (id: string, reminder: string) => void;
  onToggleCalendar: (id: string) => void;
  onAddCalendar: (calendar: Omit<CalendarDefinition, "id" | "visible">) => CalendarDefinition;
  onShowToast: (message: string) => void;
};

export function CalendarWorkspace({
  open,
  onClose,
  calendars,
  events,
  initialEventId,
  createRequest = 0,
  onSaveEvent,
  onDeleteEvent,
  onDuplicateEvent,
  onResponseChange,
  onReminderChange,
  onToggleCalendar,
  onAddCalendar,
  onShowToast,
}: CalendarWorkspaceProps) {
  const [month, setMonth] = useState(getAppToday());
  const [selectedDate, setSelectedDate] = useState(getAppToday());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"agenda" | "month">("agenda");
  const [editorEvent, setEditorEvent] = useState<CalendarEvent | null | undefined>(undefined);
  const [calendarName, setCalendarName] = useState("");
  const [calendarColor, setCalendarColor] = useState(calendarColors[3]);
  const initializedSelection = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      initializedSelection.current = null;
      return;
    }
    const selectionKey = initialEventId ?? "calendar-root";
    if (initializedSelection.current === selectionKey) return;
    initializedSelection.current = selectionKey;
    if (initialEventId) {
      const event = events.find((item) => item.id === initialEventId);
      if (event) {
        const eventDate = parseISO(event.date);
        setSelectedId(event.id);
        setSelectedDate(eventDate);
        setMonth(eventDate);
      }
    }
  }, [events, initialEventId, open]);

  useEffect(() => {
    if (open && createRequest > 0) setEditorEvent(null);
  }, [createRequest, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editorEvent !== undefined) setEditorEvent(undefined);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorEvent, onClose, open]);

  const selectedEvent = events.find((event) => event.id === selectedId) ?? null;
  const visibleIds = useMemo(
    () => new Set(calendars.filter((calendar) => calendar.visible).map((calendar) => calendar.id)),
    [calendars],
  );
  const visibleEvents = useMemo(
    () => events.filter((event) => visibleIds.has(event.calendarId)),
    [events, visibleIds],
  );
  const displayedEvents = useMemo(() => {
    if (view === "agenda") {
      return visibleEvents.filter((event) => isSameDay(parseISO(event.date), selectedDate));
    }
    return visibleEvents.filter((event) => {
      const date = parseISO(event.date);
      return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
    });
  }, [month, selectedDate, view, visibleEvents]);
  const eventDates = visibleEvents.map((event) => parseISO(event.date));

  const openNewEvent = () => {
    setEditorEvent(null);
  };

  const saveEvent = (draft: CalendarEventDraft) => {
    const saved = onSaveEvent(draft);
    setSelectedId(saved.id);
    setSelectedDate(parseISO(saved.date));
    setMonth(parseISO(saved.date));
    setEditorEvent(undefined);
    onShowToast(draft.id ? "Event updated" : "Event created");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[240] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-6"
          onMouseDown={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            className="calendar-workspace grid h-[min(860px,94vh)] w-full max-w-[1360px] grid-rows-[auto_1fr] overflow-hidden rounded-[24px] border border-white/10"
          >
            <header className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.07]">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Calendar</h2>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Private scheduling
                  </p>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    const today = getAppToday();
                    setSelectedDate(today);
                    setMonth(today);
                  }}
                  className="calendar-control"
                >
                  Today
                </button>
                <div className="flex rounded-lg border border-white/10 bg-black/15 p-0.5">
                  <button
                    onClick={() => setMonth((current) => subMonths(current, 1))}
                    className="calendar-icon-button"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setMonth((current) => addMonths(current, 1))}
                    className="calendar-icon-button"
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="hidden rounded-lg border border-white/10 bg-black/15 p-0.5 sm:flex">
                  {(["agenda", "month"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setView(mode)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-[11px] capitalize transition",
                        view === mode
                          ? "bg-white text-black"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <button onClick={openNewEvent} className="calendar-primary-button">
                  <Plus className="h-3.5 w-3.5" /> New event
                </button>
                <button
                  onClick={onClose}
                  className="calendar-icon-button"
                  aria-label="Close calendar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="grid min-h-0 lg:grid-cols-[260px_minmax(360px,1fr)_330px]">
              <aside className="scrollbar-thin overflow-y-auto border-r border-white/8 p-4">
                <Calendar
                  mode="single"
                  month={month}
                  onMonthChange={setMonth}
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  modifiers={{ hasEvent: eventDates }}
                  modifiersClassNames={{
                    hasEvent:
                      "after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-emerald-300",
                  }}
                  className="calendar-picker w-full rounded-xl border border-white/8 bg-white/[0.025]"
                />

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      My calendars
                    </span>
                    <span className="text-[10px] text-muted-foreground">{calendars.length}</span>
                  </div>
                  <div className="space-y-1">
                    {calendars.map((calendar) => (
                      <button
                        key={calendar.id}
                        onClick={() => onToggleCalendar(calendar.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition hover:bg-white/[0.05]"
                      >
                        <span
                          className={cn(
                            "grid h-4 w-4 place-items-center rounded-[5px] border",
                            calendar.visible ? "border-transparent" : "border-white/20",
                          )}
                          style={{ background: calendar.visible ? calendar.color : "transparent" }}
                        >
                          {calendar.visible && <Check className="h-2.5 w-2.5 text-black" />}
                        </span>
                        <span className="flex-1">{calendar.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {events.filter((event) => event.calendarId === calendar.id).length}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <form
                  className="mt-5 rounded-xl border border-white/8 bg-white/[0.025] p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!calendarName.trim()) return;
                    onAddCalendar({ name: calendarName.trim(), color: calendarColor });
                    onShowToast(`${calendarName.trim()} calendar created`);
                    setCalendarName("");
                  }}
                >
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Custom calendar
                  </label>
                  <input
                    value={calendarName}
                    onChange={(event) => setCalendarName(event.target.value)}
                    placeholder="Calendar name"
                    className="glow-ring mt-2 h-9 w-full rounded-lg border border-white/10 bg-black/15 px-3 text-xs"
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    {calendarColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCalendarColor(color)}
                        className={cn(
                          "h-5 w-5 rounded-full border-2 transition",
                          calendarColor === color ? "border-white" : "border-transparent",
                        )}
                        style={{ background: color }}
                        aria-label={`Use ${color}`}
                      />
                    ))}
                    <button
                      type="submit"
                      disabled={!calendarName.trim()}
                      className="ml-auto rounded-md border border-white/10 px-2 py-1 text-[10px] transition hover:bg-white/[0.06] disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </form>
              </aside>

              <main className="scrollbar-thin min-h-0 overflow-y-auto p-4 sm:p-5">
                <div className="mb-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {view === "agenda" ? format(selectedDate, "EEEE") : "Month overview"}
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold">
                      {view === "agenda"
                        ? format(selectedDate, "MMMM d, yyyy")
                        : format(month, "MMMM yyyy")}
                    </h3>
                  </div>
                  <span className="rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] text-muted-foreground">
                    {displayedEvents.length} event{displayedEvents.length === 1 ? "" : "s"}
                  </span>
                </div>

                {view === "agenda" && (
                  <div className="mb-4 grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((offset) => {
                      const date = addDays(selectedDate, offset);
                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => setSelectedDate(date)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left transition",
                            offset === 0
                              ? "border-white/20 bg-white/[0.08]"
                              : "border-white/8 bg-white/[0.025] hover:bg-white/[0.05]",
                          )}
                        >
                          <span className="block text-[10px] uppercase text-muted-foreground">
                            {format(date, "EEE")}
                          </span>
                          <span className="mt-1 block text-lg font-semibold">
                            {format(date, "d")}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-2">
                  {displayedEvents.length === 0 ? (
                    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                      <div>
                        <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
                        <p className="mt-3 text-sm font-medium">No events here</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Create an event or choose another day.
                        </p>
                        <button onClick={openNewEvent} className="calendar-primary-button mt-4">
                          <Plus className="h-3.5 w-3.5" /> Create event
                        </button>
                      </div>
                    </div>
                  ) : (
                    displayedEvents.map((event) => {
                      const calendar = calendars.find((item) => item.id === event.calendarId);
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedId(event.id)}
                          className={cn(
                            "calendar-event-row group grid w-full grid-cols-[64px_5px_1fr_auto] items-center gap-3 rounded-xl border p-3 text-left transition",
                            selectedId === event.id
                              ? "border-white/20 bg-white/[0.08]"
                              : "border-white/8 bg-white/[0.025] hover:border-white/14 hover:bg-white/[0.05]",
                          )}
                        >
                          <div>
                            <div className="text-xs font-semibold tabular-nums">{event.time}</div>
                            <div className="text-[10px] tabular-nums text-muted-foreground">
                              {event.endTime}
                            </div>
                          </div>
                          <span
                            className="h-10 rounded-full"
                            style={{ background: calendar?.color ?? "#d5d7dc" }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{event.title}</div>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {event.location}
                              </span>
                              <span className="hidden items-center gap-1 sm:flex">
                                <Users className="h-3 w-3" /> {event.organizer ?? "Private"}
                              </span>
                            </div>
                          </div>
                          <span className="rounded-md border border-white/8 px-2 py-1 text-[9px] uppercase text-muted-foreground">
                            {event.response}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </main>

              <aside className="scrollbar-thin min-h-0 overflow-y-auto border-l border-white/8 p-4">
                {selectedEvent ? (
                  <EventDetails
                    event={selectedEvent}
                    calendar={calendars.find((item) => item.id === selectedEvent.calendarId)}
                    onEdit={() => setEditorEvent(selectedEvent)}
                    onDelete={() => {
                      onDeleteEvent(selectedEvent.id);
                      setSelectedId(null);
                      onShowToast("Event deleted");
                    }}
                    onDuplicate={() => {
                      const duplicate = onDuplicateEvent(selectedEvent.id);
                      if (duplicate) {
                        setSelectedId(duplicate.id);
                        onShowToast("Event duplicated");
                      }
                    }}
                    onResponseChange={(response) => {
                      onResponseChange(selectedEvent.id, response);
                      onShowToast(`RSVP set to ${response}`);
                    }}
                    onReminderChange={(reminder) => {
                      onReminderChange(selectedEvent.id, reminder);
                      onShowToast(`Reminder set for ${reminder}`);
                    }}
                    onShowToast={onShowToast}
                  />
                ) : (
                  <div className="grid h-full min-h-56 place-items-center text-center">
                    <div>
                      <Clock3 className="mx-auto h-6 w-6 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">Select an event</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Event controls, reminders, and RSVP options appear here.
                      </p>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </motion.section>

          <AnimatePresence>
            {editorEvent !== undefined && (
              <EventEditor
                event={editorEvent}
                calendars={calendars}
                defaultDate={format(selectedDate, "yyyy-MM-dd")}
                onClose={() => setEditorEvent(undefined)}
                onSave={saveEvent}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EventDetails({
  event,
  calendar,
  onEdit,
  onDelete,
  onDuplicate,
  onResponseChange,
  onReminderChange,
  onShowToast,
}: {
  event: CalendarEvent;
  calendar?: CalendarDefinition;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onResponseChange: (response: CalendarResponse) => void;
  onReminderChange: (reminder: string) => void;
  onShowToast: (message: string) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <span
          className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
          style={{ background: calendar?.color ?? "#d5d7dc" }}
        />
        <div className="min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {calendar?.name ?? "Calendar"}
          </span>
          <h3 className="mt-1 text-xl font-semibold leading-tight">{event.title}</h3>
        </div>
        <button onClick={onEdit} className="calendar-icon-button" aria-label="Edit event">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-5 space-y-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-xs">
        <DetailRow icon={CalendarDays}>
          {format(parseISO(event.date), "EEEE, MMMM d, yyyy")}
        </DetailRow>
        <DetailRow icon={Clock3}>
          {event.time} to {event.endTime}
        </DetailRow>
        <DetailRow icon={MapPin}>{event.location}</DetailRow>
        {event.organizer && <DetailRow icon={Users}>Organized by {event.organizer}</DetailRow>}
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">{event.note}</p>

      <div className="mt-5">
        <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          RSVP
        </label>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(["going", "maybe", "declined"] as const).map((response) => (
            <button
              key={response}
              onClick={() => onResponseChange(response)}
              className={cn(
                "rounded-lg border px-2 py-2 text-[10px] capitalize transition",
                event.response === response
                  ? "border-white/20 bg-white text-black"
                  : "border-white/10 text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              {response}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Reminder
        <span className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/15 px-2">
          <Bell className="h-3.5 w-3.5" />
          <select
            value={event.reminder}
            onChange={(change) => onReminderChange(change.target.value)}
            className="h-9 flex-1 bg-transparent text-xs outline-none"
          >
            {["None", "5 minutes", "10 minutes", "15 minutes", "30 minutes", "1 hour", "1 day"].map(
              (reminder) => (
                <option key={reminder} value={reminder} className="bg-background">
                  {reminder}
                </option>
              ),
            )}
          </select>
        </span>
      </label>

      <div className="mt-5 grid grid-cols-2 gap-2">
        {event.meetingUrl && (
          <button
            onClick={() => {
              window.open(event.meetingUrl, "_blank", "noopener,noreferrer");
              onShowToast("Opening meeting");
            }}
            className="calendar-primary-button"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Join
          </button>
        )}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(`${event.title} - ${event.date} ${event.time}`);
            onShowToast("Event details copied");
          }}
          className="calendar-control"
        >
          <Copy className="h-3.5 w-3.5" /> Copy details
        </button>
      </div>

      <div className="mt-5 flex gap-2 border-t border-white/8 pt-4">
        <button onClick={onDuplicate} className="calendar-control flex-1">
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <button
          onClick={onDelete}
          className="calendar-control text-red-300 hover:border-red-300/20 hover:bg-red-300/5"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 text-foreground/85">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span>{children}</span>
    </div>
  );
}

function EventEditor({
  event,
  calendars,
  defaultDate,
  onClose,
  onSave,
}: {
  event: CalendarEvent | null;
  calendars: CalendarDefinition[];
  defaultDate: string;
  onClose: () => void;
  onSave: (event: CalendarEventDraft) => void;
}) {
  const [draft, setDraft] = useState<CalendarEventDraft>(() =>
    event
      ? { ...event }
      : {
          title: "",
          date: defaultDate,
          time: "09:00",
          endTime: "10:00",
          location: "",
          note: "",
          calendarId: calendars[0]?.id ?? "personal",
          cadence: "One time",
          response: "going",
          reminder: "15 minutes",
        },
  );

  const update = <Key extends keyof CalendarEventDraft>(key: Key, value: CalendarEventDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 grid place-items-center bg-black/65 p-4 backdrop-blur-md"
      onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}
    >
      <motion.form
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (!draft.title.trim()) return;
          onSave({ ...draft, title: draft.title.trim() });
        }}
        className="calendar-editor w-full max-w-xl rounded-2xl border border-white/10 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {event ? "Update schedule" : "New schedule"}
            </p>
            <h3 className="mt-1 text-xl font-semibold">{event ? "Edit event" : "Create event"}</h3>
          </div>
          <button type="button" onClick={onClose} className="calendar-icon-button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <Field label="Event title">
            <input
              autoFocus
              required
              value={draft.title}
              onChange={(change) => update("title", change.target.value)}
              placeholder="What is happening?"
              className="calendar-input"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input
                required
                type="date"
                value={draft.date}
                onChange={(change) => update("date", change.target.value)}
                className="calendar-input"
              />
            </Field>
            <Field label="Calendar">
              <select
                value={draft.calendarId}
                onChange={(change) => update("calendarId", change.target.value)}
                className="calendar-input"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id} className="bg-background">
                    {calendar.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Starts">
              <input
                required
                type="time"
                value={draft.time}
                onChange={(change) => update("time", change.target.value)}
                className="calendar-input"
              />
            </Field>
            <Field label="Ends">
              <input
                required
                type="time"
                value={draft.endTime}
                onChange={(change) => update("endTime", change.target.value)}
                className="calendar-input"
              />
            </Field>
            <Field label="Repeats">
              <select
                value={draft.cadence}
                onChange={(change) => update("cadence", change.target.value)}
                className="calendar-input"
              >
                {["One time", "Daily", "Weekly", "Monthly"].map((cadence) => (
                  <option key={cadence} value={cadence} className="bg-background">
                    {cadence}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Location or call link">
            <input
              value={draft.location}
              onChange={(change) => update("location", change.target.value)}
              placeholder="Add a location"
              className="calendar-input"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={draft.note}
              onChange={(change) => update("note", change.target.value)}
              rows={4}
              placeholder="Agenda, context, or preparation notes"
              className="calendar-input min-h-24 resize-none py-2.5"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="calendar-control">
            Cancel
          </button>
          <button type="submit" disabled={!draft.title.trim()} className="calendar-primary-button">
            {event ? "Save changes" : "Create event"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
