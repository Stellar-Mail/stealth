import { useMemo, useState } from "react";
import { Filter, MailPlus } from "lucide-react";
import type {
  ConfidentialModeSummary as Summary,
  ConfidentialSuggestion,
  ConfidentialSuggestionStatus,
} from "../types";
import { ConfidentialModeEmptyState } from "./ConfidentialModeEmptyState";
import { ConfidentialModeErrorState } from "./ConfidentialModeErrorState";
import { ConfidentialModeLoadingState } from "./ConfidentialModeLoadingState";
import { ConfidentialModeSummary } from "./ConfidentialModeSummary";
import { ConfidentialSuggestionCard } from "./ConfidentialSuggestionCard";

type ToolViewState = "loading" | "error" | "ready";
type FilterValue = "all" | ConfidentialSuggestionStatus;

interface ConfidentialModeSuggestionToolProps {
  errorMessage?: string;
  initialState?: ToolViewState;
  onApplySuggestion?: (suggestion: ConfidentialSuggestion) => void;
  onDismissSuggestion?: (suggestion: ConfidentialSuggestion) => void;
  onRequestDraft?: () => void;
  suggestions?: ConfidentialSuggestion[];
}

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Suggested", value: "suggested" },
  { label: "Blocked", value: "blocked" },
  { label: "Safe", value: "safe" },
];

function summarizeSuggestions(suggestions: ConfidentialSuggestion[]): Summary {
  return suggestions.reduce(
    (summary, suggestion) => {
      summary.totalSuggestions += 1;
      summary[suggestion.status] += 1;
      return summary;
    },
    {
      totalSuggestions: 0,
      suggested: 0,
      blocked: 0,
      safe: 0,
    },
  );
}

export function ConfidentialModeSuggestionTool({
  errorMessage,
  initialState = "ready",
  onApplySuggestion,
  onDismissSuggestion,
  onRequestDraft,
  suggestions = [],
}: ConfidentialModeSuggestionToolProps) {
  const [viewState, setViewState] = useState<ToolViewState>(initialState);
  const [filter, setFilter] = useState<FilterValue>("all");

  const summary = useMemo(() => summarizeSuggestions(suggestions), [suggestions]);
  const filteredSuggestions = useMemo(
    () =>
      filter === "all"
        ? suggestions
        : suggestions.filter((suggestion) => suggestion.status === filter),
    [filter, suggestions],
  );

  if (viewState === "loading") {
    return <ConfidentialModeLoadingState />;
  }

  if (viewState === "error") {
    return (
      <ConfidentialModeErrorState details={errorMessage} onRetry={() => setViewState("ready")} />
    );
  }

  if (suggestions.length === 0) {
    return (
      <ConfidentialModeEmptyState
        action={
          onRequestDraft ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onRequestDraft}
              type="button"
            >
              <MailPlus aria-hidden="true" className="size-4" />
              Add draft sample
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="confidential-mode-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Individual V2 tool
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="confidential-mode-title">
          Confidential Mode Suggestion
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review draft privacy signals and decide whether confidential mode, manual review, or a
          standard send is appropriate.
        </p>
      </header>

      <ConfidentialModeSummary summary={summary} />

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Filter aria-hidden="true" className="size-4" />
          Filter suggestions
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">Confidential-mode suggestion filter</legend>
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
                name="confidential-mode-filter"
                onChange={() => setFilter(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      </div>

      {filteredSuggestions.length > 0 ? (
        <div aria-label="Confidential-mode suggestion results" className="space-y-3" role="list">
          {filteredSuggestions.map((suggestion) => (
            <div key={suggestion.id} role="listitem">
              <ConfidentialSuggestionCard
                onApplySuggestion={onApplySuggestion}
                onDismissSuggestion={onDismissSuggestion}
                suggestion={suggestion}
              />
            </div>
          ))}
        </div>
      ) : (
        <ConfidentialModeEmptyState
          description="No suggestions match the current filter. Choose another status to continue reviewing."
          title="No matching suggestions"
        />
      )}
    </section>
  );
}

export { summarizeSuggestions };
export type { ConfidentialModeSuggestionToolProps };
