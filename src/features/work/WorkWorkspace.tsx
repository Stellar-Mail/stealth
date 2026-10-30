import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CheckSquare2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Trash2,
} from "lucide-react";
import type { Email } from "@/components/mail/data";
import type { CalendarEvent } from "@/features/calendar/types";
import { InternalCommentThread } from "@/tools/v1/team/internal-comment-thread/InternalCommentThread";
import type { WorkSession, WorkView } from "./model";
import "./work.css";

type Props = {
  view: WorkView;
  emails: Email[];
  events: CalendarEvent[];
  session: WorkSession;
  update: (mutate: (session: WorkSession) => WorkSession) => void;
  onSelect: (view: WorkView) => void;
  onOpenEmail: (email: Email) => void;
  onOpenCalendar: (id?: string) => void;
  onExit: () => void;
  previewAllowed: boolean;
};

export function WorkWorkspace({
  view,
  emails,
  events,
  session,
  update,
  onSelect,
  onOpenEmail,
  onOpenCalendar,
  onExit,
  previewAllowed,
}: Props) {
  const [taskTitle, setTaskTitle] = useState("");
  const [linkedEmailId, setLinkedEmailId] = useState("");
  const [noteEmailId, setNoteEmailId] = useState("");
  const mail = emails.filter((email) => !["spam", "trash"].includes(email.folder));
  const noteEmail = mail.find((email) => email.id === noteEmailId) ?? mail[0];
  const pendingTasks = session.tasks.filter((task) => !task.done);
  const calendarEvents = [...events].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );
  const title = {
    overview: "Your work, in focus",
    mail: "Mail",
    tasks: "Tasks",
    calendar: "Calendar",
    notes: "Private notes",
  }[view];

  if (!previewAllowed) {
    return (
      <section
        className="work-surface m-3 flex flex-1 items-center justify-center rounded-2xl p-8 text-center"
        aria-label="Work access"
      >
        <div className="max-w-sm">
          <LockKeyhole className="mx-auto mb-5 h-7 w-7 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Work is in preview</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Paid Work access is not connected yet. No subscription will be charged. Your Personal
            mailbox is still available.
          </p>
          <button className="work-action mt-6" onClick={onExit}>
            Back to Personal
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Work workspace"
      className="work-surface m-3 min-h-0 min-w-0 flex-1 overflow-y-auto rounded-2xl p-5 sm:p-8"
    >
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Stealth / Work
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            Developer preview. Private to this session; no team sync or billing.
          </p>
        </div>
        {view === "calendar" && (
          <button className="work-action" onClick={() => onOpenCalendar()}>
            <Plus className="h-3.5 w-3.5" />
            Open planner
          </button>
        )}
      </header>

      {view === "overview" && (
        <div className="space-y-7">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Open tasks",
                value: pendingTasks.length,
                icon: CheckSquare2,
                target: "tasks" as const,
              },
              {
                label: "Calendar events",
                value: events.length,
                icon: CalendarDays,
                target: "calendar" as const,
              },
              {
                label: "Private notes",
                value: Object.values(session.notes).reduce(
                  (count, notes) => count + notes.length,
                  0,
                ),
                icon: MessageSquareText,
                target: "notes" as const,
              },
            ].map(({ label, value, icon: Icon, target }) => (
              <button
                key={target}
                onClick={() => onSelect(target)}
                className="work-tile glow-ring p-5 text-left"
              >
                <span className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{label}</span>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="mt-4 block text-3xl font-medium tabular-nums">{value}</span>
              </button>
            ))}
          </div>
          <div className="work-tile p-5">
            <h2 className="text-sm font-semibold">Flagged for follow-up</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your starred mail. Open a conversation to continue.
            </p>
            <div className="mt-4 divide-y divide-border">
              {mail
                .filter((email) => email.starred)
                .slice(0, 6)
                .map((email) => (
                  <button
                    key={email.id}
                    onClick={() => onOpenEmail(email)}
                    className="glow-ring flex w-full items-center gap-3 rounded-md py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{email.subject}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{email.from}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              {!mail.some((email) => email.starred) && (
                <p className="py-5 text-sm text-muted-foreground">
                  Star a conversation to keep it here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "tasks" && (
        <div className="max-w-3xl space-y-5">
          <form
            className="work-tile flex flex-wrap gap-3 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const title = taskTitle.trim();
              if (!title) return;
              update((current) => ({
                ...current,
                tasks: [
                  ...current.tasks,
                  {
                    id: crypto.randomUUID(),
                    title,
                    emailId: linkedEmailId || undefined,
                    done: false,
                  },
                ],
              }));
              setTaskTitle("");
            }}
          >
            <input
              aria-label="Task title"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="What needs to get done?"
              className="work-input min-w-0 flex-[1_1_250px]"
            />
            <select
              aria-label="Link task to mail"
              value={linkedEmailId}
              onChange={(event) => setLinkedEmailId(event.target.value)}
              className="work-input min-w-0 max-w-full flex-[1_1_200px]"
            >
              <option value="">No linked conversation</option>
              {mail.map((email) => (
                <option key={email.id} value={email.id}>
                  {email.subject}
                </option>
              ))}
            </select>
            <button className="work-action" type="submit">
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          </form>
          <ul className="space-y-3" aria-label="Work tasks">
            {session.tasks.map((task) => {
              const linked = mail.find((email) => email.id === task.emailId);
              return (
                <li key={task.id} className="work-tile flex items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={task.done}
                    aria-label={`Complete ${task.title}`}
                    onChange={() =>
                      update((current) => ({
                        ...current,
                        tasks: current.tasks.map((item) =>
                          item.id === task.id ? { ...item, done: !item.done } : item,
                        ),
                      }))
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={
                        task.done
                          ? "break-words text-sm text-muted-foreground line-through"
                          : "break-words text-sm"
                      }
                    >
                      {task.title}
                    </p>
                    {linked && (
                      <button
                        onClick={() => onOpenEmail(linked)}
                        className="mt-1 max-w-full truncate text-left text-xs text-muted-foreground underline underline-offset-4"
                      >
                        {linked.subject}
                      </button>
                    )}
                  </div>
                  <button
                    aria-label={`Delete ${task.title}`}
                    onClick={() =>
                      update((current) => ({
                        ...current,
                        tasks: current.tasks.filter((item) => item.id !== task.id),
                      }))
                    }
                    className="glow-ring rounded-md p-2 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {!session.tasks.length && (
            <p className="py-8 text-sm text-muted-foreground">
              No tasks yet. Add one, optionally linked to a conversation.
            </p>
          )}
        </div>
      )}

      {view === "calendar" && (
        <div className="max-w-3xl space-y-3">
          {calendarEvents.map((event) => (
            <button
              key={event.id}
              onClick={() => onOpenCalendar(event.id)}
              className="work-tile glow-ring flex w-full items-center gap-4 p-5 text-left"
            >
              <CalendarDays className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{event.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {event.date} / {event.time}
                  {event.location ? ` / ${event.location}` : ""}
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {!calendarEvents.length && (
            <p className="py-8 text-sm text-muted-foreground">
              No calendar events yet. Open the planner to create one.
            </p>
          )}
        </div>
      )}

      {view === "notes" && (
        <div className="max-w-3xl space-y-5">
          <label className="block text-xs text-muted-foreground">
            Conversation
            <select
              className="work-input mt-2 w-full"
              aria-label="Notes conversation"
              value={noteEmail?.id ?? ""}
              onChange={(event) => setNoteEmailId(event.target.value)}
            >
              {mail.map((email) => (
                <option key={email.id} value={email.id}>
                  {email.from} / {email.subject}
                </option>
              ))}
            </select>
          </label>
          {noteEmail ? (
            <InternalCommentThread
              key={noteEmail.id}
              comments={session.notes[noteEmail.id] ?? []}
              onPost={(content) =>
                update((current) => ({
                  ...current,
                  notes: {
                    ...current.notes,
                    [noteEmail.id]: [
                      ...(current.notes[noteEmail.id] ?? []),
                      {
                        id: crypto.randomUUID(),
                        author: "You",
                        content,
                        timestamp: new Date().toISOString(),
                      },
                    ],
                  },
                }))
              }
            />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              A conversation is needed before adding a private note.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
