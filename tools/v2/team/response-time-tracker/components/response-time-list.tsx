import { Clock, Inbox } from "lucide-react";
import type { FetchState, ResponseTimeEntry, TeamMember } from "../types";
import { ResponseTimeItem } from "./response-time-item";

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-border/30 bg-white/[0.03] px-5 py-4"
        >
          <div className="size-10 animate-pulse rounded-lg bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 animate-pulse rounded bg-white/10" />
            <div className="h-3 w-32 animate-pulse rounded bg-white/10" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-xl border border-red-500/30 bg-red-500/10 p-8 text-center backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-500/20">
        <Clock className="size-6 text-red-400" aria-hidden="true" />
      </div>
      <p className="mb-2 text-sm font-medium text-red-400">Failed to load response times</p>
      <p className="mb-6 text-xs text-red-400/70">{message}</p>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
          aria-label="Retry loading response times"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl border border-border/30 bg-white/[0.02] p-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl border border-border/40 bg-white/5 text-muted-foreground">
        <Inbox className="size-6" aria-hidden="true" />
      </div>
      <p className="text-lg font-medium text-foreground">No response times yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Response time data will appear here once team members start replying to threads.
      </p>
    </div>
  );
}

interface ResponseTimeListProps {
  state: FetchState<ResponseTimeEntry[]>;
  teamMembers: FetchState<TeamMember[]>;
  onRetry?: () => void;
}

function getTeamMemberMap(members: TeamMember[]): Map<string, TeamMember> {
  const map = new Map<string, TeamMember>();
  for (const m of members) {
    map.set(m.id, m);
  }
  return map;
}

export function ResponseTimeList({ state, teamMembers, onRetry }: ResponseTimeListProps) {
  switch (state.status) {
    case "loading":
      return (
        <div aria-busy="true" aria-label="Loading response time entries">
          <LoadingSkeleton />
        </div>
      );
    case "error":
      return <ErrorState message={state.message} onRetry={onRetry} />;
    case "empty":
      return <EmptyState />;
    case "success": {
      const memberMap =
        teamMembers.status === "success" ? getTeamMemberMap(teamMembers.data) : new Map();

      return (
        <div role="list" aria-label="Response time entries" className="space-y-2">
          {state.data.map((entry) => (
            <ResponseTimeItem
              key={entry.id}
              entry={entry}
              teamMember={memberMap.get(entry.teamMemberId)}
            />
          ))}
        </div>
      );
    }
  }
}
