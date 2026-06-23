import type { SharedInboxActionHandlers, SharedInboxMessage } from "../types";

interface SharedInboxMessageCardProps extends SharedInboxActionHandlers {
  message: SharedInboxMessage;
}

const statusLabels = {
  unassigned: "Unassigned",
  claimed: "Claimed",
  "in-progress": "In progress",
  "awaiting-reply": "Awaiting reply",
  resolved: "Resolved",
} as const;

const statusClasses = {
  unassigned: "border-slate-300 bg-slate-50 text-slate-700",
  claimed: "border-sky-300 bg-sky-50 text-sky-800",
  "in-progress": "border-violet-300 bg-violet-50 text-violet-800",
  "awaiting-reply": "border-amber-300 bg-amber-50 text-amber-900",
  resolved: "border-emerald-300 bg-emerald-50 text-emerald-800",
} as const;

function formatReceivedAt(receivedAt: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(receivedAt));
}

export function SharedInboxMessageCard({
  message,
  onClaim,
  onRelease,
  onOpenMessage,
  onReply,
}: SharedInboxMessageCardProps) {
  const titleId = `shared-inbox-message-${message.id}-title`;
  const statusLabel = statusLabels[message.status];
  const hasAssignee = Boolean(message.assignee);

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm focus-within:ring-2 focus-within:ring-slate-900"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses[message.status]}`}
              aria-label={`Message status: ${statusLabel}`}
            >
              {statusLabel}
            </span>
            <span className="text-xs font-medium text-slate-500">{message.team}</span>
          </div>

          <h3 id={titleId} className="mt-3 text-lg font-semibold text-slate-950">
            {message.subject}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{message.preview}</p>

          <dl className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-slate-800">Sender</dt>
              <dd>{message.senderAddress}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-800">Received</dt>
              <dd>
                <time dateTime={message.receivedAt}>{formatReceivedAt(message.receivedAt)}</time>
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-800">Owner</dt>
              <dd>
                {message.assignee
                  ? `${message.assignee.displayName} (${message.assignee.stealthAddress})`
                  : "No owner yet"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-800">Activity</dt>
              <dd>
                {message.internalCommentCount} internal comments, {message.replyCount} replies
              </dd>
            </div>
          </dl>
        </div>

        <div
          className="grid min-w-40 gap-2 sm:grid-cols-3 lg:grid-cols-1"
          role="group"
          aria-label={`Actions for ${message.subject}`}
        >
          <button
            type="button"
            onClick={() => (hasAssignee ? onRelease?.(message.id) : onClaim?.(message.id))}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`${hasAssignee ? "Release" : "Claim"} shared inbox message ${message.subject}`}
          >
            {hasAssignee ? "Release" : "Claim"}
          </button>
          <button
            type="button"
            onClick={() => onOpenMessage?.(message.id)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`Open shared inbox message ${message.subject}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => onReply?.(message.id)}
            className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            aria-label={`Reply to ${message.subject} as shared inbox`}
          >
            Reply
          </button>
        </div>
      </div>
    </article>
  );
}
