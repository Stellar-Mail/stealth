import { useMemo, useState } from "react";
import { Filter, MailPlus } from "lucide-react";
import type {
  OwnershipRecord,
  OwnershipStatus,
  OwnershipSummary as Summary,
} from "../types";
import { OwnershipEmptyState } from "./OwnershipEmptyState";
import { OwnershipErrorState } from "./OwnershipErrorState";
import { OwnershipLoadingState } from "./OwnershipLoadingState";
import { OwnershipRecordCard } from "./OwnershipRecordCard";
import { OwnershipSummary } from "./OwnershipSummary";

type TrackerViewState = "loading" | "error" | "ready";
type FilterValue = "all" | OwnershipStatus;

interface EmailOwnershipTrackerProps {
  errorMessage?: string;
  initialState?: TrackerViewState;
  onClaim?: (record: OwnershipRecord) => void;
  onRelease?: (record: OwnershipRecord) => void;
  onRequestRecords?: () => void;
  onTransfer?: (record: OwnershipRecord) => void;
  records?: OwnershipRecord[];
}

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Unassigned", value: "unassigned" },
  { label: "Owned", value: "owned" },
  { label: "Stale", value: "stale" },
  { label: "Resolved", value: "resolved" },
];

function summarizeOwnership(records: OwnershipRecord[]): Summary {
  return records.reduce(
    (summary, record) => {
      summary.totalMessages += 1;
      summary[record.status] += 1;
      return summary;
    },
    {
      totalMessages: 0,
      unassigned: 0,
      owned: 0,
      stale: 0,
      resolved: 0,
    },
  );
}

export function EmailOwnershipTracker({
  errorMessage,
  initialState = "ready",
  onClaim,
  onRelease,
  onRequestRecords,
  onTransfer,
  records = [],
}: EmailOwnershipTrackerProps) {
  const [viewState, setViewState] = useState<TrackerViewState>(initialState);
  const [filter, setFilter] = useState<FilterValue>("all");

  const summary = useMemo(() => summarizeOwnership(records), [records]);
  const filteredRecords = useMemo(
    () => (filter === "all" ? records : records.filter((record) => record.status === filter)),
    [filter, records],
  );

  if (viewState === "loading") {
    return <OwnershipLoadingState />;
  }

  if (viewState === "error") {
    return <OwnershipErrorState details={errorMessage} onRetry={() => setViewState("ready")} />;
  }

  if (records.length === 0) {
    return (
      <OwnershipEmptyState
        action={
          onRequestRecords ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onRequestRecords}
              type="button"
            >
              <MailPlus aria-hidden="true" className="size-4" />
              Add ownership sample
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="email-ownership-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Team V1 tool</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="email-ownership-title">
          Email Ownership Tracker
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Track message ownership, spot stale handoffs, and keep shared inbox work from being
          duplicated.
        </p>
      </header>

      <OwnershipSummary summary={summary} />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter aria-hidden="true" className="size-4" />
          Filter ownership
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Ownership status filter</legend>
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
                name="email-ownership-filter"
                onChange={() => setFilter(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

      {filteredRecords.length > 0 ? (
        <div aria-label="Email ownership records" className="space-y-3" role="list">
          {filteredRecords.map((record) => (
            <div key={record.id} role="listitem">
              <OwnershipRecordCard
                onClaim={onClaim}
                onRelease={onRelease}
                onTransfer={onTransfer}
                record={record}
              />
            </div>
          ))}
        </div>
      ) : (
        <OwnershipEmptyState
          description="No ownership records match the current filter. Choose another status to continue reviewing."
          title="No matching ownership records"
        />
      )}
    </section>
  );
}

export { summarizeOwnership };
export type { EmailOwnershipTrackerProps };
