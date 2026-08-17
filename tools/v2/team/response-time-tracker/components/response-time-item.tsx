import { AlertCircle, CheckCircle2, Clock, TimerOff } from "lucide-react";
import type { ResponseTimeEntry, TeamMember } from "../types";

function formatDuration(ms: number): string {
  const hours = ms / 3600000;
  if (hours < 1) {
    const mins = Math.round(ms / 60000);
    return `${mins}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ResponseTimeItemProps {
  entry: ResponseTimeEntry;
  teamMember?: TeamMember;
}

const statusConfig = {
  met: {
    icon: CheckCircle2,
    label: "Within SLA",
    class: "text-green-500",
    bgClass: "bg-green-500/10",
  },
  missed: {
    icon: Clock,
    label: "Missed SLA",
    class: "text-amber-500",
    bgClass: "bg-amber-500/10",
  },
  breached: {
    icon: AlertCircle,
    label: "Breached",
    class: "text-red-500",
    bgClass: "bg-red-500/10",
  },
} as const;

export function ResponseTimeItem({ entry, teamMember }: ResponseTimeItemProps) {
  const status = statusConfig[entry.status];
  const StatusIcon = status.icon;

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl border border-border/30 bg-white/[0.03] px-5 py-4 transition-colors hover:bg-white/[0.06] focus-within:ring-2 focus-within:ring-ring/50"
      role="listitem"
      aria-label={`Response to "${entry.subject}" — ${status.label}`}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${status.bgClass}`}
        aria-hidden="true"
      >
        <StatusIcon className={`size-5 ${status.class}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{entry.subject}</p>
        <p className="truncate text-xs text-muted-foreground">
          From: {entry.from}
          {teamMember ? ` · Responded by: ${teamMember.name}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div className="hidden sm:block">
          <p className="text-xs text-muted-foreground">Sent</p>
          <p className="text-xs text-foreground">{formatDateTime(entry.sentAt)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Response</p>
          <p className="text-xs text-foreground">{formatDateTime(entry.respondedAt)}</p>
        </div>
        <div className="min-w-[4rem]">
          <p className="text-xs text-muted-foreground">Duration</p>
          <p className="text-sm font-semibold text-foreground">
            {formatDuration(entry.responseTimeMs)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.bgClass} ${status.class}`}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
