import { CheckCircle2, EyeOff, LockKeyhole, ShieldAlert } from "lucide-react";
import type { ConfidentialSuggestion } from "../types";

interface ConfidentialSuggestionCardProps {
  onApplySuggestion?: (suggestion: ConfidentialSuggestion) => void;
  onDismissSuggestion?: (suggestion: ConfidentialSuggestion) => void;
  suggestion: ConfidentialSuggestion;
}

const statusStyles: Record<ConfidentialSuggestion["status"], string> = {
  suggested: "border-blue-200 bg-blue-50 text-blue-800",
  blocked: "border-red-200 bg-red-50 text-red-800",
  safe: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const statusIcons = {
  suggested: LockKeyhole,
  blocked: ShieldAlert,
  safe: CheckCircle2,
};

function formatMode(suggestion: ConfidentialSuggestion): string {
  if (suggestion.recommendedMode === "confidential-mode") {
    return "Confidential mode";
  }
  if (suggestion.recommendedMode === "manual-review") {
    return "Manual review";
  }
  return "Standard send";
}

export function ConfidentialSuggestionCard({
  onApplySuggestion,
  onDismissSuggestion,
  suggestion,
}: ConfidentialSuggestionCardProps) {
  const StatusIcon = statusIcons[suggestion.status];

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md border ${statusStyles[suggestion.status]}`}
        >
          <StatusIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">
              {suggestion.draftTitle}
            </h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[suggestion.status]}`}
            >
              {suggestion.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700">
            {formatMode(suggestion)} for {suggestion.recipientLabel}
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-600">{suggestion.reason}</p>

          <ul aria-label={`Privacy signals for ${suggestion.draftTitle}`} className="mt-4 space-y-2">
            {suggestion.signals.map((signal) => (
              <li
                className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
                key={signal.id}
              >
                <span className="font-medium text-slate-950">{signal.label}</span>
                <span className="ml-2 rounded-md bg-white px-2 py-1 text-xs text-slate-600">
                  {signal.severity}
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  {signal.evidence}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {onApplySuggestion && suggestion.status === "suggested" ? (
            <button
              aria-label={`Apply confidential mode to ${suggestion.draftTitle}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onApplySuggestion(suggestion)}
              type="button"
            >
              <LockKeyhole aria-hidden="true" className="size-4" />
              Apply
            </button>
          ) : null}
          {onDismissSuggestion ? (
            <button
              aria-label={`Dismiss privacy suggestion for ${suggestion.draftTitle}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onDismissSuggestion(suggestion)}
              type="button"
            >
              <EyeOff aria-hidden="true" className="size-4" />
              Dismiss
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
        {suggestion.suggestedAction}
      </p>
    </article>
  );
}

export type { ConfidentialSuggestionCardProps };
