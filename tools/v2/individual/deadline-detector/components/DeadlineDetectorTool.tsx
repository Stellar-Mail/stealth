import { useMemo, useState } from "react";
import { Filter, MailPlus } from "lucide-react";
import { detectDeadlines } from "../services";
import type { DeadlineMessage, DeadlineStatus, DetectedDeadline } from "../types";
import { DeadlineDetectorEmptyState } from "./DeadlineDetectorEmptyState";
import { DeadlineDetectorErrorState } from "./DeadlineDetectorErrorState";
import { DeadlineDetectorLoadingState } from "./DeadlineDetectorLoadingState";
import { DeadlineDetectorSummary } from "./DeadlineDetectorSummary";
import { DeadlineResultCard } from "./DeadlineResultCard";

type DetectorViewState = "loading" | "error" | "ready";
type FilterValue = "all" | DeadlineStatus;

interface DeadlineDetectorToolProps {
  errorMessage?: string;
  initialState?: DetectorViewState;
  messages?: DeadlineMessage[];
  now?: string;
  onCreateReminder?: (deadline: DetectedDeadline) => void;
  onRequestMessages?: () => void;
  onReviewDeadline?: (deadline: DetectedDeadline) => void;
}

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Detected", value: "detected" },
  { label: "Review", value: "needs-review" },
  { label: "Missed", value: "missed" },
  { label: "Ignored", value: "ignored" },
];

export function DeadlineDetectorTool({
  errorMessage,
  initialState = "ready",
  messages = [],
  now,
  onCreateReminder,
  onRequestMessages,
  onReviewDeadline,
}: DeadlineDetectorToolProps) {
  const [viewState, setViewState] = useState<DetectorViewState>(initialState);
  const [filter, setFilter] = useState<FilterValue>("all");

  const result = useMemo(() => detectDeadlines(messages, { now }), [messages, now]);
  const filteredDeadlines = useMemo(
    () =>
      filter === "all"
        ? result.deadlines
        : result.deadlines.filter((deadline) => deadline.status === filter),
    [filter, result.deadlines],
  );

  if (viewState === "loading") {
    return (
      <DeadlineDetectorLoadingState message="Scanning selected messages for deadline signals..." />
    );
  }

  if (viewState === "error") {
    return (
      <DeadlineDetectorErrorState details={errorMessage} onRetry={() => setViewState("ready")} />
    );
  }

  if (messages.length === 0) {
    return (
      <DeadlineDetectorEmptyState
        action={
          onRequestMessages ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onRequestMessages}
              type="button"
            >
              <MailPlus aria-hidden="true" className="size-4" />
              Add message sample
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="deadline-detector-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Individual V2 tool
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="deadline-detector-title">
            Deadline Detector
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Detect likely due dates, expired requests, and ambiguous deadline language before a
            future inbox integration creates reminders.
          </p>
        </div>
      </header>

      <DeadlineDetectorSummary summary={result.summary} />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter aria-hidden="true" className="size-4" />
          Filter results
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Deadline status filter</legend>
          {filterOptions.map((option) => (
            <label
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                filter === option.value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              key={option.value}
            >
              <input
                checked={filter === option.value}
                className="sr-only"
                name="deadline-filter"
                onChange={() => setFilter(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

      {filteredDeadlines.length > 0 ? (
        <div aria-label="Detected deadline results" className="space-y-3" role="list">
          {filteredDeadlines.map((deadline) => (
            <div key={deadline.id} role="listitem">
              <DeadlineResultCard
                deadline={deadline}
                onCreateReminder={onCreateReminder}
                onReviewDeadline={onReviewDeadline}
              />
            </div>
          ))}
        </div>
      ) : (
        <DeadlineDetectorEmptyState
          description="No deadlines match the current filter. Choose another status to continue reviewing."
          title="No matching deadlines"
        />
      )}
    </section>
  );
}

export type { DeadlineDetectorToolProps };
