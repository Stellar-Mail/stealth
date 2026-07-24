import { useMemo } from "react";
import { EmailOwnershipEmptyState } from "./EmailOwnershipEmptyState";
import { EmailOwnershipLoadingState } from "./EmailOwnershipLoadingState";
import { EmailOwnershipErrorState } from "./EmailOwnershipErrorState";
import { EmailOwnershipSummary } from "./EmailOwnershipSummary";
import { OwnershipRecordCard } from "./OwnershipRecordCard";

interface OwnershipRecord {
  threadId: string;
  currentOwner: string | null;
  state: string;
  handoffCount: number;
  firstEvent: string;
  lastEvent: string;
}

interface EmailOwnershipTrackerProps {
  loading?: boolean;
  error?: string;
  records?: OwnershipRecord[];
}

export function EmailOwnershipTracker({
  loading = false,
  error,
  records = [],
}: EmailOwnershipTrackerProps) {
  const summary = useMemo(
    () => ({
      threadCount: records.length,
      ownerCount: records.filter((r) => r.currentOwner).length,
      handoffCount: records.reduce((sum, record) => sum + record.handoffCount, 0),
      anomalyCount: 0,
    }),
    [records],
  );

  if (loading) {
    return <EmailOwnershipLoadingState />;
  }

  if (error) {
    return <EmailOwnershipErrorState details={error} />;
  }

  if (records.length === 0) {
    return <EmailOwnershipEmptyState />;
  }

  return (
    <section
      aria-labelledby="ownership-tracker-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <h1 id="ownership-tracker-title" className="text-2xl font-semibold text-slate-950">
          Email Ownership Tracker
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review ownership history and identify the latest owner for each email thread.
        </p>
      </header>

      <EmailOwnershipSummary {...summary} />

      <div role="list" aria-label="Ownership records" className="space-y-3">
        {records.map((record) => (
          <div key={record.threadId} role="listitem">
            <OwnershipRecordCard record={record} />
          </div>
        ))}
      </div>
    </section>
  );
}

export type { EmailOwnershipTrackerProps };
