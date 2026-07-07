import React from "react";
import { AlertTriangle, CheckCircle2, FileWarning, Loader2, ShieldCheck } from "lucide-react";

export type LegalReviewSeverity = "low" | "medium" | "high" | "critical";
export type LegalReviewStatus = "pending" | "needs-review" | "approved" | "blocked";
export type LegalReviewSurfaceState = "loading" | "error" | "empty" | "success";

export interface LegalReviewItem {
  id: string;
  subject: string;
  requester: string;
  department: string;
  severity: LegalReviewSeverity;
  status: LegalReviewStatus;
  reason: string;
  receivedAt: string;
}

export interface LegalComplianceReviewFlagProps {
  state: LegalReviewSurfaceState;
  items?: LegalReviewItem[];
  selectedId?: string;
  errorMessage?: string;
  onSelectItem?: (id: string) => void;
  onApprove?: (id: string) => void;
  onEscalate?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onRetry?: () => void;
}

const severityTone: Record<LegalReviewSeverity, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-cyan-50 text-cyan-800 border-cyan-200",
  high: "bg-amber-50 text-amber-800 border-amber-200",
  critical: "bg-red-50 text-red-800 border-red-200",
};

function getSelectedItem(items: LegalReviewItem[], selectedId?: string) {
  return items.find((item) => item.id === selectedId) || items[0];
}

function StatePanel({
  state,
  errorMessage,
  onRetry,
}: Pick<LegalComplianceReviewFlagProps, "state" | "errorMessage" | "onRetry">) {
  if (state === "loading") {
    return (
      <section
        className="rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm"
        role="status"
        aria-live="polite"
        aria-label="Loading legal compliance review flags"
      >
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-700" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-950">Loading review queue</h2>
        <p className="mt-2 text-sm text-slate-600">Preparing folder-local review flags.</p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section
        className="rounded-md border border-red-200 bg-red-50 p-8 shadow-sm"
        role="alert"
        aria-live="assertive"
        aria-label="Legal compliance review flags failed to load"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-red-950">Review flags unavailable</h2>
            <p className="mt-2 text-sm text-red-800">
              {errorMessage || "The local review surface could not load the current flags."}
            </p>
            {onRetry && (
              <button
                type="button"
                className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 outline-none transition hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                onClick={onRetry}
                aria-label="Retry loading legal compliance review flags"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center"
      role="status"
      aria-live="polite"
      aria-label="No legal compliance review flags"
    >
      <ShieldCheck className="mx-auto mb-4 h-8 w-8 text-emerald-700" aria-hidden="true" />
      <h2 className="text-base font-semibold text-slate-950">No flags need review</h2>
      <p className="mt-2 text-sm text-slate-600">
        The isolated queue is empty. New flagged messages can be reviewed here after future
        integration.
      </p>
    </section>
  );
}

function ReviewList({
  items,
  selectedId,
  onSelectItem,
}: {
  items: LegalReviewItem[];
  selectedId?: string;
  onSelectItem?: (id: string) => void;
}) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white shadow-sm"
      aria-labelledby="legal-review-queue-heading"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 id="legal-review-queue-heading" className="text-sm font-semibold text-slate-950">
          Flagged messages
        </h2>
      </div>
      <div className="divide-y divide-slate-200" role="list" aria-label="Legal review flag list">
        {items.map((item) => {
          const selected = item.id === selectedId;

          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              aria-pressed={selected}
              aria-label={`Open legal review flag ${item.subject}`}
              className={`w-full px-4 py-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-inset ${
                selected ? "bg-cyan-50" : "bg-white hover:bg-slate-50"
              }`}
              onClick={() => onSelectItem?.(item.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item.subject}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {item.requester} / {item.department}
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2 py-1 text-xs font-semibold ${severityTone[item.severity]}`}
                >
                  {item.severity}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ReviewDetail({
  item,
  onApprove,
  onEscalate,
  onDismiss,
}: {
  item: LegalReviewItem;
  onApprove?: (id: string) => void;
  onEscalate?: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="legal-review-detail-heading"
    >
      <div className="flex items-start gap-3">
        <FileWarning className="mt-1 h-5 w-5 text-amber-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Selected flag</p>
          <h2
            id="legal-review-detail-heading"
            className="mt-1 text-xl font-semibold text-slate-950"
          >
            {item.subject}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Requester</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.requester}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Received</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.receivedAt}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Status</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.status}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Department</dt>
          <dd className="mt-1 text-sm text-slate-900">{item.department}</dd>
        </div>
      </dl>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label={`Actions for ${item.subject}`}
      >
        <button
          type="button"
          className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          onClick={() => onApprove?.(item.id)}
          aria-label={`Approve legal review flag ${item.subject}`}
        >
          <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
          Approve
        </button>
        <button
          type="button"
          className="rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-amber-800 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2"
          onClick={() => onEscalate?.(item.id)}
          aria-label={`Escalate legal review flag ${item.subject}`}
        >
          Escalate
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          onClick={() => onDismiss?.(item.id)}
          aria-label={`Dismiss legal review flag ${item.subject}`}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}

export function LegalComplianceReviewFlag({
  state,
  items = [],
  selectedId,
  errorMessage,
  onSelectItem,
  onApprove,
  onEscalate,
  onDismiss,
  onRetry,
}: LegalComplianceReviewFlagProps) {
  if (state !== "success" || items.length === 0) {
    return (
      <StatePanel
        state={state === "success" ? "empty" : state}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    );
  }

  const selected = getSelectedItem(items, selectedId);

  return (
    <main
      className="mx-auto grid max-w-6xl gap-4 bg-slate-100 p-4 text-slate-950 md:grid-cols-[minmax(280px,360px)_1fr]"
      aria-labelledby="legal-review-title"
    >
      <header className="md:col-span-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800">
          Legal and compliance
        </p>
        <h1 id="legal-review-title" className="mt-1 text-2xl font-semibold text-slate-950">
          Review flagged messages
        </h1>
      </header>
      <ReviewList items={items} selectedId={selected.id} onSelectItem={onSelectItem} />
      <ReviewDetail
        item={selected}
        onApprove={onApprove}
        onEscalate={onEscalate}
        onDismiss={onDismiss}
      />
    </main>
  );
}
