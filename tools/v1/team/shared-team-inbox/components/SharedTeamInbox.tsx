import type {
  SharedInboxActionHandlers,
  SharedInboxMessage,
  SharedInboxMessageStatus,
  SharedInboxSummary,
} from "../types";
import { SharedInboxEmptyState } from "./SharedInboxEmptyState";
import { SharedInboxErrorState } from "./SharedInboxErrorState";
import { SharedInboxLoadingState } from "./SharedInboxLoadingState";
import { SharedInboxMessageCard } from "./SharedInboxMessageCard";
import { SharedInboxSuccessState } from "./SharedInboxSuccessState";
import { SharedInboxSummary as SharedInboxSummaryView } from "./SharedInboxSummary";

interface SharedTeamInboxProps extends SharedInboxActionHandlers {
  messages: SharedInboxMessage[];
  summary: SharedInboxSummary;
  activeStatus?: SharedInboxMessageStatus | "all";
  isLoading?: boolean;
  error?: string | null;
  successMessage?: string | null;
  onRetry?: () => void;
  onDismissSuccess?: () => void;
}

const filters: Array<{ value: SharedInboxMessageStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "unassigned", label: "Unassigned" },
  { value: "claimed", label: "Claimed" },
  { value: "in-progress", label: "In progress" },
  { value: "awaiting-reply", label: "Awaiting reply" },
  { value: "resolved", label: "Resolved" },
];

export function SharedTeamInbox({
  messages,
  summary,
  activeStatus = "all",
  isLoading = false,
  error = null,
  successMessage = null,
  onRetry,
  onDismissSuccess,
  onStatusFilterChange,
  onClaim,
  onRelease,
  onOpenMessage,
  onReply,
}: SharedTeamInboxProps) {
  if (isLoading) {
    return <SharedInboxLoadingState />;
  }

  if (error) {
    return <SharedInboxErrorState message={error} onRetry={onRetry} />;
  }

  const visibleMessages =
    activeStatus === "all"
      ? messages
      : messages.filter((message) => message.status === activeStatus);

  const activeFilterLabel =
    filters.find((filter) => filter.value === activeStatus)?.label.toLowerCase() ?? "messages";

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6" aria-labelledby="shared-team-inbox-title">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Team workflow
        </p>
        <h1 id="shared-team-inbox-title" className="text-2xl font-semibold text-slate-950">
          Shared Team Inbox
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Triage shared mail, claim ownership, review internal activity, and reply through the
          shared identity without exposing an individual mailbox.
        </p>
      </header>

      {successMessage ? (
        <SharedInboxSuccessState message={successMessage} onDismiss={onDismissSuccess} />
      ) : null}

      <SharedInboxSummaryView summary={summary} />

      <section aria-labelledby="shared-inbox-filter-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="shared-inbox-filter-title" className="text-base font-semibold text-slate-950">
            Message queue
          </h2>
          <fieldset className="flex flex-wrap gap-2" aria-label="Filter shared inbox by status">
            <legend className="sr-only">Filter shared inbox by status</legend>
            {filters.map((filter) => (
              <label
                key={filter.value}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus-within:ring-2 focus-within:ring-slate-900 focus-within:ring-offset-2"
              >
                <input
                  type="radio"
                  name="shared-inbox-status-filter"
                  value={filter.value}
                  checked={activeStatus === filter.value}
                  onChange={() => onStatusFilterChange?.(filter.value)}
                  className="sr-only"
                />
                {filter.label}
              </label>
            ))}
          </fieldset>
        </div>

        {visibleMessages.length === 0 ? (
          <SharedInboxEmptyState activeFilter={activeFilterLabel} />
        ) : (
          <div className="space-y-4" role="list" aria-label="Shared inbox messages">
            {visibleMessages.map((message) => (
              <div role="listitem" key={message.id}>
                <SharedInboxMessageCard
                  message={message}
                  onClaim={onClaim}
                  onRelease={onRelease}
                  onOpenMessage={onOpenMessage}
                  onReply={onReply}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
