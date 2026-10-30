import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import type { Email } from "@/components/mail/data";
import type { CalendarEvent } from "@/features/calendar";
import type { WorkSession } from "@/features/work/model";
import { useContacts } from "../useContacts";
import { cn } from "@/lib/utils";
import { ToolIcon, type ToolIconName } from "./ToolIcon";
import "./tools-rail.css";

const PrivateNotes = lazy(() =>
  import("@/tools/v1/team/internal-comment-thread/InternalCommentThread").then((module) => ({
    default: module.InternalCommentThread,
  })),
);
const tools: ReadonlyArray<{ id: ToolIconName; label: string; workOnly?: boolean }> = [
  { id: "calendar", label: "Calendar" },
  { id: "people", label: "People" },
  { id: "files", label: "Files" },
  { id: "saved", label: "Saved mail" },
  { id: "followups", label: "Follow-ups" },
  { id: "proofs", label: "Proofs" },
  { id: "tasks", label: "Tasks", workOnly: true },
  { id: "notes", label: "Private notes", workOnly: true },
];

export function MailToolsRail({
  actor,
  emails,
  selected,
  events,
  workEnabled,
  session,
  update,
  onOpenCalendar,
  onOpenEmail,
  onCompose,
  onImportContacts,
  onToggleSaved,
  onSnooze,
  onOpenProofInspector,
}: {
  actor: string | null;
  emails: Email[];
  selected: Email | null;
  events: CalendarEvent[];
  workEnabled: boolean;
  session: WorkSession;
  update: (mutate: (session: WorkSession) => WorkSession) => void;
  onOpenCalendar: (eventId?: string) => void;
  onOpenEmail: (email: Email) => void;
  onCompose: (address: string) => void;
  onImportContacts: () => void;
  onToggleSaved: (email: Email) => void;
  onSnooze: (email: Email) => void;
  onOpenProofInspector: () => void;
}) {
  const [active, setActive] = useState<ToolIconName | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const contacts = useContacts(actor, active === "people");
  const available = tools.filter((tool) => !tool.workOnly || workEnabled);
  const activeTool = available.find((tool) => tool.id === active);
  const mail = useMemo(
    () => emails.filter((email) => !["trash", "spam"].includes(email.folder)),
    [emails],
  );
  const people = useMemo(() => {
    if (actor)
      return (
        contacts.data?.items.map((contact) => ({
          id: contact.contactId,
          name: contact.name,
          address: contact.address,
        })) ?? []
      );
    return Array.from(
      new Map(
        mail
          .filter((email) => email.folder !== "sent" && email.folder !== "drafts")
          .map((email) => [
            email.email,
            { id: email.email, name: email.from, address: email.email },
          ]),
      ).values(),
    );
  }, [actor, contacts.data, mail]);
  const files = useMemo(
    () =>
      mail.flatMap((email) =>
        (email.attachments ?? []).map((file, index) => ({
          email,
          file,
          key: `${email.id}-${index}`,
        })),
      ),
    [mail],
  );
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [events],
  );
  const collection = useMemo(
    () =>
      mail.filter((email) => {
        if (active === "saved") return email.starred;
        if (active === "followups") return email.folder === "snoozed" || Boolean(email.snooze);
        if (active === "proofs") return email.folder === "pending";
        return false;
      }),
    [active, mail],
  );

  useEffect(() => {
    panelRef.current?.focus();
  }, [active]);
  const close = () => {
    railRef.current?.querySelector<HTMLButtonElement>(`[data-tool="${active}"]`)?.focus();
    setActive(null);
  };

  return (
    <div ref={railRef} className={cn("mail-tools-rail", collapsed && "mail-tools-rail--collapsed")}>
      <nav
        aria-label={workEnabled ? "Work tools" : "Mail tools"}
        className="flex h-full flex-col items-center gap-2 overflow-y-auto py-2"
      >
        {!collapsed &&
          available.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              data-tool={id}
              aria-label={`Open ${label.toLowerCase()} tool`}
              title={label}
              aria-expanded={active === id}
              aria-controls={active === id ? "mail-tool-panel" : undefined}
              className="mail-tool-trigger glow-ring"
              onClick={() => setActive(active === id ? null : id)}
            >
              <ToolIcon name={id} />
            </button>
          ))}
        <button
          type="button"
          aria-label={collapsed ? "Show tools rail" : "Hide tools rail"}
          title={collapsed ? "Show tools" : "Hide tools"}
          className="mail-tool-trigger glow-ring mt-auto"
          onClick={() => {
            setActive(null);
            setCollapsed(!collapsed);
          }}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </nav>
      {activeTool && !collapsed && (
        <section
          ref={panelRef}
          id="mail-tool-panel"
          role="region"
          aria-label={`${activeTool.label} tool`}
          tabIndex={-1}
          className="mail-tool-panel"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">{activeTool.label}</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close tool panel"
              className="glow-ring rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {active === "calendar" && (
              <>
                <button
                  type="button"
                  className="mail-tool-action mb-4"
                  onClick={() => {
                    close();
                    onOpenCalendar();
                  }}
                >
                  Open calendar
                </button>
                <ul className="space-y-1">
                  {sortedEvents.map((event) => (
                    <li key={event.id}>
                      <button
                        type="button"
                        className="mail-tool-row"
                        onClick={() => {
                          close();
                          onOpenCalendar(event.id);
                        }}
                      >
                        <span className="block text-sm font-medium">{event.title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {event.date} / {event.time}
                        </span>
                        {event.location && (
                          <span className="mt-1 block truncate text-xs text-muted-foreground">
                            {event.location}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                {!events.length && (
                  <p className="text-sm text-muted-foreground">
                    No events yet. Open the calendar to plan your first one.
                  </p>
                )}
              </>
            )}
            {active === "people" && (
              <>
                <button
                  type="button"
                  className="mail-tool-action mb-4"
                  onClick={() => {
                    close();
                    onImportContacts();
                  }}
                >
                  Import contacts
                </button>
                <p className="mb-3 text-xs text-muted-foreground">
                  {actor ? "Saved contacts" : "People from this demo mailbox"}
                </p>
                {contacts.isLoading && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading contacts...
                  </p>
                )}
                {contacts.isError && (
                  <div role="alert" className="text-sm text-muted-foreground">
                    Contacts could not be loaded.{" "}
                    <button className="underline" onClick={() => void contacts.refetch()}>
                      Retry
                    </button>
                  </div>
                )}
                <ul className="space-y-1">
                  {people.map((person) => (
                    <li key={person.id}>
                      <button
                        type="button"
                        className="mail-tool-row"
                        aria-label={`Write to ${person.name}`}
                        onClick={() => {
                          close();
                          onCompose(person.address);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{person.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {person.address}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!people.length && !contacts.isLoading && !contacts.isError && (
                  <p className="text-sm text-muted-foreground">No contacts yet.</p>
                )}
                {contacts.data?.hasMore && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Showing the first page of saved contacts.
                  </p>
                )}
              </>
            )}
            {active === "files" && (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  Attachments in loaded mail. Open a message to view its files.
                </p>
                <ul className="space-y-1">
                  {files.map(({ email, file, key }) => (
                    <li key={key}>
                      <button
                        type="button"
                        className="mail-tool-row"
                        onClick={() => {
                          close();
                          onOpenEmail(email);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{file.name}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {email.from} / {file.size}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!files.length && (
                  <p className="text-sm text-muted-foreground">
                    No attachments in loaded messages.
                  </p>
                )}
              </>
            )}
            {(active === "saved" || active === "followups" || active === "proofs") && (
              <>
                {active === "saved" && (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Keep important conversations close. Saved mail uses your existing stars.
                    </p>
                    <button
                      type="button"
                      disabled={!selected}
                      className="mail-tool-action mb-4 disabled:opacity-40"
                      onClick={() => selected && onToggleSaved(selected)}
                    >
                      {selected?.starred ? "Remove current mail from saved" : "Save current mail"}
                    </button>
                  </>
                )}
                {active === "followups" && (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Snoozed conversations and their scheduled reminders.
                    </p>
                    <button
                      type="button"
                      disabled={!selected}
                      className="mail-tool-action mb-4 disabled:opacity-40"
                      onClick={() => {
                        if (selected) {
                          close();
                          onSnooze(selected);
                        }
                      }}
                    >
                      Set a reminder for this mail
                    </button>
                  </>
                )}
                {active === "proofs" && (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Look up a message hash or transaction in the proof inspector.
                    </p>
                    <button
                      type="button"
                      className="mail-tool-action mb-4"
                      onClick={() => {
                        close();
                        onOpenProofInspector();
                      }}
                    >
                      Open proof inspector
                    </button>
                    <p className="mb-2 text-xs text-muted-foreground">Mail awaiting proof</p>
                  </>
                )}
                <ul className="space-y-1">
                  {collection.map((email) => (
                    <li key={email.id}>
                      <button
                        type="button"
                        className="mail-tool-row"
                        onClick={() => {
                          close();
                          onOpenEmail(email);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{email.subject}</span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {email.from}
                          {active === "followups" && email.snooze ? ` / ${email.snooze.label}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                {!collection.length && (
                  <p className="text-sm text-muted-foreground">
                    {active === "saved"
                      ? "No saved mail yet."
                      : active === "followups"
                        ? "No follow-ups scheduled."
                        : "No loaded mail is awaiting proof."}
                  </p>
                )}
              </>
            )}
            {active === "tasks" && workEnabled && (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  Work preview. Tasks stay in this session and reset on reload.
                </p>
                <button
                  type="button"
                  disabled={!selected}
                  className="mail-tool-action mb-4 disabled:opacity-40"
                  onClick={() =>
                    selected &&
                    update((current) => ({
                      ...current,
                      tasks: [
                        ...current.tasks,
                        {
                          id: crypto.randomUUID(),
                          title: selected.subject,
                          emailId: selected.id,
                          done: false,
                        },
                      ],
                    }))
                  }
                >
                  Make this mail a task
                </button>
                <ul className="space-y-3">
                  {session.tasks.map((task) => {
                    const linked = mail.find((email) => email.id === task.emailId);
                    return (
                      <li
                        key={task.id}
                        className="flex items-start gap-2 border-b border-border pb-3"
                      >
                        <input
                          type="checkbox"
                          aria-label={`Complete ${task.title}`}
                          className="mt-1 accent-primary"
                          checked={task.done}
                          onChange={() =>
                            update((current) => ({
                              ...current,
                              tasks: current.tasks.map((item) =>
                                item.id === task.id ? { ...item, done: !item.done } : item,
                              ),
                            }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "break-words text-sm",
                              task.done && "text-muted-foreground line-through",
                            )}
                          >
                            {task.title}
                          </p>
                          {linked && (
                            <button
                              className="mt-1 text-xs text-muted-foreground underline"
                              onClick={() => {
                                close();
                                onOpenEmail(linked);
                              }}
                            >
                              Open message
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          className="glow-ring rounded p-1 text-muted-foreground"
                          aria-label={`Delete ${task.title}`}
                          onClick={() =>
                            update((current) => ({
                              ...current,
                              tasks: current.tasks.filter((item) => item.id !== task.id),
                            }))
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {!session.tasks.length && (
                  <p className="text-sm text-muted-foreground">
                    No tasks yet. Turn the open mail into a follow-up.
                  </p>
                )}
              </>
            )}
            {active === "notes" &&
              workEnabled &&
              (selected ? (
                <>
                  <p className="mb-3 truncate text-xs text-muted-foreground">{selected.subject}</p>
                  <Suspense fallback={<p role="status">Opening notes...</p>}>
                    <PrivateNotes
                      key={selected.id}
                      comments={session.notes[selected.id] ?? []}
                      onPost={(content) =>
                        update((current) => ({
                          ...current,
                          notes: {
                            ...current.notes,
                            [selected.id]: [
                              ...(current.notes[selected.id] ?? []),
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
                  </Suspense>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open a message to keep a private note beside it.
                </p>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
