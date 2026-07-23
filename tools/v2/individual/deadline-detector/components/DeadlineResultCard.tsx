import { CalendarPlus, CheckCircle2, Clock, Eye, FileQuestion, XCircle } from "lucide-react";
import type { DetectedDeadline } from "../types";

interface DeadlineResultCardProps {
  deadline: DetectedDeadline;
  onCreateReminder?: (deadline: DetectedDeadline) => void;
  onReviewDeadline?: (deadline: DetectedDeadline) => void;
}

const urgencyStyles: Record<DetectedDeadline["urgency"], string> = {
  overdue: "border-red-200 bg-red-50 text-red-800",
  today: "border-amber-200 bg-amber-50 text-amber-800",
  soon: "border-blue-200 bg-blue-50 text-blue-800",
  later: "border-emerald-200 bg-emerald-50 text-emerald-800",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusIcon = {
  detected: CheckCircle2,
  "needs-review": FileQuestion,
  missed: XCircle,
  ignored: Eye,
};

function formatDueDate(deadline: DetectedDeadline): string {
  if (!deadline.dueDate) {
    return "No date found";
  }
  if (!deadline.dueTime) {
    return deadline.dueDate;
  }
  return `${deadline.dueDate} at ${deadline.dueTime} ${deadline.timezone}`;
}

export function DeadlineResultCard({
  deadline,
  onCreateReminder,
  onReviewDeadline,
}: DeadlineResultCardProps) {
  const StatusIcon = statusIcon[deadline.status];
  const confidence = `${Math.round(deadline.confidence * 100)}% confidence`;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md border ${
            urgencyStyles[deadline.urgency]
          }`}
        >
          <StatusIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">{deadline.title}</h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${
                urgencyStyles[deadline.urgency]
              }`}
            >
              {deadline.urgency}
            </span>
          </div>

          <p className="mt-2 flex items-center gap-2 text-sm text-slate-700">
            <Clock aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
            <span>{formatDueDate(deadline)}</span>
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-600">{deadline.evidence}</p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            <span className="rounded-md bg-slate-100 px-2 py-1">{deadline.status}</span>
            <span className="rounded-md bg-slate-100 px-2 py-1">{confidence}</span>
            {deadline.reviewRequired ? (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800">
                review required
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {onCreateReminder && deadline.status === "detected" ? (
            <button
              aria-label={`Create reminder for ${deadline.title}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onCreateReminder(deadline)}
              type="button"
            >
              <CalendarPlus aria-hidden="true" className="size-4" />
              Remind
            </button>
          ) : null}
          {onReviewDeadline && deadline.reviewRequired ? (
            <button
              aria-label={`Review ${deadline.title}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onReviewDeadline(deadline)}
              type="button"
            >
              <Eye aria-hidden="true" className="size-4" />
              Review
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
        {deadline.suggestedAction}
      </p>
    </article>
  );
}

export type { DeadlineResultCardProps };
