import { CheckCircle2, Clock3, RotateCcw, UserCheck, UserPlus } from "lucide-react";
import type { OwnershipRecord } from "../types";

interface OwnershipRecordCardProps {
  onClaim?: (record: OwnershipRecord) => void;
  onRelease?: (record: OwnershipRecord) => void;
  onTransfer?: (record: OwnershipRecord) => void;
  record: OwnershipRecord;
}

const statusStyles: Record<OwnershipRecord["status"], string> = {
  unassigned: "border-blue-200 bg-blue-50 text-blue-800",
  owned: "border-emerald-200 bg-emerald-50 text-emerald-800",
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  resolved: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusIcons = {
  unassigned: UserPlus,
  owned: UserCheck,
  stale: Clock3,
  resolved: CheckCircle2,
};

export function OwnershipRecordCard({
  onClaim,
  onRelease,
  onTransfer,
  record,
}: OwnershipRecordCardProps) {
  const StatusIcon = statusIcons[record.status];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md border ${statusStyles[record.status]}`}
        >
          <StatusIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">
              {record.subject}
            </h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[record.status]}`}
            >
              {record.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {record.senderLabel} · {record.team}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {record.owner ? `Owned by ${record.owner}` : "No owner assigned"} · Updated{" "}
            {record.ageMinutes} minutes ago
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{record.lastAction}</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {record.status === "unassigned" && onClaim ? (
            <button
              aria-label={`Claim ownership of ${record.subject}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onClaim(record)}
              type="button"
            >
              <UserPlus aria-hidden="true" className="size-4" />
              Claim
            </button>
          ) : null}
          {record.status !== "unassigned" && record.status !== "resolved" && onTransfer ? (
            <button
              aria-label={`Transfer ownership of ${record.subject}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onTransfer(record)}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Transfer
            </button>
          ) : null}
          {record.status !== "unassigned" && record.status !== "resolved" && onRelease ? (
            <button
              aria-label={`Release ownership of ${record.subject}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onRelease(record)}
              type="button"
            >
              Release
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export type { OwnershipRecordCardProps };
