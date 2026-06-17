import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  ArrowUpRight,
  Calendar,
  CalendarPlus,
  ChevronRight,
  Paperclip,
  Send,
  Sparkles,
  User,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { getAppToday, type CalendarDefinition, type CalendarEvent } from "@/features/calendar";
import { ConvertSenderButton, SenderBadge } from "@/features/sender-conversion";
import { ProvenancePanel } from "./ProvenancePanel";
import { EmailTrustBadges } from "./EmailTrustBadges";
import type { Email } from "./data";

export type ContextAction = "snooze" | "translate" | "schedule" | "summarize";

export function RightPanel({
  email,
  onAction,
  onDraftReply,
  onConvertSender,
  onSnooze,
  calendarEvents,
  calendars,
  onShowToast,
  onOpenCalendar,
  onCreateEvent,
  onPreviewAttachment,
}: {
  email: Email | null;
  onAction: (action: ContextAction, email: Email) => void;
  onDraftReply: (email: Email, prompt: string) => void;
  onConvertSender: (email: Email) => void;
  onSnooze: (email: Email) => void;
  calendarEvents: CalendarEvent[];
  calendars: CalendarDefinition[];
  onShowToast?: (message: string) => void;
  onOpenCalendar: (eventId?: string) => void;
  onCreateEvent: () => void;
  onPreviewAttachment?: (attachment: { name: string; size: string; type: string }) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const runAction = (action: ContextAction) => {
    if (!email) return;
    if (action === "snooze") {
      // Snooze opens the guided dialog instead of an instant folder move.
      onSnooze(email);
      return;
    }
    if (action === "summarize") {
      setSummary(
        `${email.from} is writing about ${email.subject.toLowerCase()}. The next step is to respond or review the attached context.`,
      );
    }
    onAction(action, email);
  };

  const draftReply = () => {
    if (!email || !prompt.trim()) return;
    onDraftReply(email, prompt.trim());
    setPrompt("");
  };

  return (
    <aside className="scrollbar-thin m-3 ml-0 hidden h-[calc(100vh-1.5rem-3.5rem)] w-[292px] shrink-0 flex-col gap-3 overflow-y-auto 2xl:flex">
      <Card>
        <SectionHeader icon={Sparkles} title="AI assistant" badge="beta" />
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-foreground/80">
          {summary ??
            (email
              ? `${email.from} is sharing the latest direction on "${email.subject}".`
              : "Pick a thread and I'll summarize it, suggest replies, and extract action items.")}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && draftReply()}
            placeholder="Ask AI to draft a reply..."
            className="glow-ring h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs placeholder:text-muted-foreground/70"
          />
          <motion.button
            whileTap={{ scale: 0.94 }}
            disabled={!email || !prompt.trim()}
            onClick={draftReply}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-foreground transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </Card>

      <Card>
        <SectionHeader icon={ArrowUpRight} title="Quick actions" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["snooze", "translate", "schedule", "summarize"] as const).map((action) => (
            <motion.button
              key={action}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              disabled={!email}
              onClick={() => runAction(action)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-foreground/90 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {action[0].toUpperCase() + action.slice(1)}
            </motion.button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center">
          <SectionHeader icon={Calendar} title="Today" />
          <button
            onClick={onCreateEvent}
            className="ml-auto rounded-md p-1.5 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            aria-label="Create calendar event"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {calendarEvents
            .filter((event) => isSameDay(parseISO(event.date), getAppToday()))
            .slice(0, 4)
            .map((event) => {
              const calendar = calendars.find((item) => item.id === event.calendarId);
              return (
                <li key={event.title} className="group rounded-lg transition hover:bg-white/[0.04]">
                  <button
                    onClick={() => onOpenCalendar(event.id)}
                    className="flex w-full items-center gap-3 px-2 py-1.5 text-left"
                  >
                    <span
                      className="h-8 w-1 rounded-full"
                      style={{ background: calendar?.color ?? "oklch(0.75 0.005 270)" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] tabular-nums text-muted-foreground">
                        {event.time} - {event.endTime}
                      </div>
                      <div className="truncate text-xs text-foreground">{event.title}</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
        </ul>
        <button
          onClick={() => onOpenCalendar()}
          className="mt-3 flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-[10px] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
        >
          <span>{format(getAppToday(), "MMMM d")} schedule</span>
          <span>Open calendar</span>
        </button>
      </Card>

      {email?.attachments?.length ? (
        <Card>
          <SectionHeader icon={Paperclip} title="Attachments" />
          <ul className="mt-3 space-y-1.5">
            {email.attachments.map((attachment) => (
              <li
                key={attachment.name}
                onClick={() => onPreviewAttachment?.(attachment)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 transition duration-150",
                  onPreviewAttachment && "cursor-pointer hover:bg-white/[0.06]",
                )}
              >
                <div className="grid h-7 w-7 place-items-center rounded-md bg-white/[0.05] text-[9px] font-bold uppercase text-muted-foreground">
                  {attachment.type}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs text-foreground">{attachment.name}</div>
                  <div className="text-[10px] text-muted-foreground">{attachment.size}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {email && (
        <Card>
          <SectionHeader icon={Shield} title="Provenance" />
          <div className="mt-3">
            <ProvenancePanel email={email} onShowToast={onShowToast} />
          </div>
        </Card>
      )}

      {email && (
        <Card>
          <SectionHeader icon={User} title="Contact" />
          <div className="mt-3 flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-full text-xs font-medium text-white/90"
              style={{ background: `linear-gradient(135deg, ${email.avatarColor}, #1a1a1d)` }}
            >
              {email.from
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm text-foreground">{email.from}</span>
                <SenderBadge policy={email.senderPolicy} />
                <EmailTrustBadges email={email} max={3} size="sm" className="ml-1" />
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{email.email}</div>
            </div>
          </div>
          <ConvertSenderButton
            variant="subtle"
            label={email.senderPolicy ? "Update sender policy" : "Convert to contact"}
            onClick={() => onConvertSender(email)}
            className="mt-3 w-full justify-center"
          />
        </Card>
      )}
    </aside>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="glass rounded-2xl p-4">{children}</div>;
}

function SectionHeader({
  icon: Icon,
  title,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  badge?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </span>
      {badge && (
        <span className="ml-auto rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/80">
          {badge}
        </span>
      )}
    </div>
  );
}
