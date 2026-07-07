import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  MessageSquarePlus,
  TicketCheck,
} from "lucide-react";

export type MailTicketPriority = "low" | "normal" | "high" | "urgent";
export type MailTicketStatus = "draft" | "needs-triage" | "ready" | "blocked";
export type MailTicketSurfaceState = "loading" | "error" | "empty" | "success";

export interface MailTicketDraft {
  id: string;
  subject: string;
  sender: string;
  queue: string;
  priority: MailTicketPriority;
  status: MailTicketStatus;
  summary: string;
  recommendedAssignee: string;
  receivedAt: string;
}

export interface MailToTicketConverterSurfaceProps {
  state: MailTicketSurfaceState;
  drafts?: MailTicketDraft[];
  selectedId?: string;
  errorMessage?: string;
  onSelectDraft?: (id: string) => void;
  onCreateTicket?: (id: string) => void;
  onRequestMoreContext?: (id: string) => void;
  onDismissDraft?: (id: string) => void;
  onRetry?: () => void;
}

const priorityTone: Record<MailTicketPriority, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700",
  normal: "border-cyan-200 bg-cyan-50 text-cyan-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  urgent: "border-red-200 bg-red-50 text-red-800",
};

function getSelectedDraft(drafts: MailTicketDraft[], selectedId?: string) {
  return drafts.find((draft) => draft.id === selectedId) || drafts[0];
}

function StatePanel({
  state,
  errorMessage,
  onRetry,
}: Pick<MailToTicketConverterSurfaceProps, "state" | "errorMessage" | "onRetry">) {
  if (state === "loading") {
    return (
      <section
        className="rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm"
        role="status"
        aria-live="polite"
        aria-label="Loading mail-to-ticket converter drafts"
        aria-busy="true"
      >
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-700" aria-hidden="true" />
        <h2 className="text-base font-semibold text-slate-950">Loading ticket drafts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Preparing isolated mail-to-ticket suggestions.
        </p>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section
        className="rounded-md border border-red-200 bg-red-50 p-8 shadow-sm"
        role="alert"
        aria-live="assertive"
        aria-label="Mail-to-ticket converter failed to load"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold text-red-950">Ticket drafts unavailable</h2>
            <p className="mt-2 text-sm text-red-800">
              {errorMessage || "The local converter surface could not load the draft queue."}
            </p>
            {onRetry && (
              <button
                type="button"
                className="mt-4 rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-900 outline-none transition hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                onClick={onRetry}
                aria-label="Retry loading mail-to-ticket converter drafts"
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
      aria-label="No mail-to-ticket converter drafts"
    >
      <Inbox className="mx-auto mb-4 h-8 w-8 text-emerald-700" aria-hidden="true" />
      <h2 className="text-base font-semibold text-slate-950">No drafts need conversion</h2>
      <p className="mt-2 text-sm text-slate-600">
        The isolated queue is empty. Future mail integration can populate this surface without
        changing the main app shell.
      </p>
    </section>
  );
}

function DraftQueue({
  drafts,
  selectedId,
  onSelectDraft,
}: {
  drafts: MailTicketDraft[];
  selectedId?: string;
  onSelectDraft?: (id: string) => void;
}) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white shadow-sm"
      aria-labelledby="mail-ticket-queue-heading"
    >
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 id="mail-ticket-queue-heading" className="text-sm font-semibold text-slate-950">
          Draft queue
        </h2>
      </div>
      <ul className="divide-y divide-slate-200" role="list" aria-label="Mail ticket draft list">
        {drafts.map((draft) => {
          const selected = draft.id === selectedId;

          return (
            <li key={draft.id}>
              <button
                type="button"
                aria-current={selected ? "true" : undefined}
                aria-label={`Open ticket draft for ${draft.subject}`}
                className={`w-full px-4 py-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-inset ${
                  selected ? "bg-cyan-50" : "bg-white hover:bg-slate-50"
                }`}
                onClick={() => onSelectDraft?.(draft.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{draft.subject}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {draft.sender} / {draft.queue}
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-semibold ${priorityTone[draft.priority]}`}
                  >
                    {draft.priority}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DraftDetail({
  draft,
  onCreateTicket,
  onRequestMoreContext,
  onDismissDraft,
}: {
  draft: MailTicketDraft;
  onCreateTicket?: (id: string) => void;
  onRequestMoreContext?: (id: string) => void;
  onDismissDraft?: (id: string) => void;
}) {
  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="mail-ticket-detail-heading"
    >
      <div className="flex items-start gap-3">
        <Mail className="mt-1 h-5 w-5 text-cyan-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">Selected mail draft</p>
          <h2 id="mail-ticket-detail-heading" className="mt-1 text-xl font-semibold text-slate-950">
            {draft.subject}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{draft.summary}</p>
        </div>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Sender</dt>
          <dd className="mt-1 text-sm text-slate-900">{draft.sender}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Received</dt>
          <dd className="mt-1 text-sm text-slate-900">{draft.receivedAt}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Status</dt>
          <dd className="mt-1 text-sm text-slate-900">{draft.status}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase text-slate-500">Suggested owner</dt>
          <dd className="mt-1 text-sm text-slate-900">{draft.recommendedAssignee}</dd>
        </div>
      </dl>

      <div
        className="mt-5 flex flex-wrap gap-2"
        role="group"
        aria-label={`Actions for ticket draft ${draft.subject}`}
      >
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white outline-none transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
          onClick={() => onCreateTicket?.(draft.id)}
          aria-label={`Create ticket from ${draft.subject}`}
        >
          <TicketCheck className="h-4 w-4" aria-hidden="true" />
          Create Ticket
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900 outline-none transition hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-cyan-700 focus-visible:ring-offset-2"
          onClick={() => onRequestMoreContext?.(draft.id)}
          aria-label={`Ask for context about ${draft.subject}`}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Ask for Context
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          onClick={() => onDismissDraft?.(draft.id)}
          aria-label={`Dismiss ticket draft ${draft.subject}`}
        >
          Dismiss Draft
        </button>
      </div>
    </section>
  );
}

export function MailToTicketConverterSurface({
  state,
  drafts = [],
  selectedId,
  errorMessage,
  onSelectDraft,
  onCreateTicket,
  onRequestMoreContext,
  onDismissDraft,
  onRetry,
}: MailToTicketConverterSurfaceProps) {
  if (state !== "success" || drafts.length === 0) {
    return (
      <StatePanel
        state={state === "success" ? "empty" : state}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    );
  }

  const selectedDraft = getSelectedDraft(drafts, selectedId);

  return (
    <section
      className="mx-auto grid w-full max-w-5xl gap-4 bg-slate-100 p-4 md:grid-cols-[minmax(17rem,22rem)_1fr]"
      aria-labelledby="mail-ticket-surface-heading"
    >
      <div className="md:col-span-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              Mail-to-Ticket Converter
            </p>
            <h1
              id="mail-ticket-surface-heading"
              className="mt-1 text-2xl font-semibold text-slate-950"
            >
              Ticket draft review
            </h1>
          </div>
          <div
            className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {drafts.length} ready
          </div>
        </div>
      </div>

      <DraftQueue drafts={drafts} selectedId={selectedDraft.id} onSelectDraft={onSelectDraft} />
      <DraftDetail
        draft={selectedDraft}
        onCreateTicket={onCreateTicket}
        onRequestMoreContext={onRequestMoreContext}
        onDismissDraft={onDismissDraft}
      />
    </section>
  );
}
