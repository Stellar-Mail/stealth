import { useMemo } from "react";
import { analyzeConfidentialMode } from "../services";
import type { ConfidentialModeInput } from "../types";
import { ConfidentialModeSuggestionEmptyState } from "./ConfidentialModeSuggestionEmptyState";
import { ConfidentialModeSuggestionErrorState } from "./ConfidentialModeSuggestionErrorState";
import { ConfidentialModeSuggestionLoadingState } from "./ConfidentialModeSuggestionLoadingState";
import { ConfidentialModeSuggestionSummary } from "./ConfidentialModeSuggestionSummary";
import { ConfidentialModeRecommendationCard } from "./ConfidentialModeRecommendationCard";

interface ConfidentialModeSuggestionToolProps {
  draft?: ConfidentialModeInput;
  loading?: boolean;
  error?: string;
}

export function ConfidentialModeSuggestionTool({
  draft,
  loading = false,
  error,
}: ConfidentialModeSuggestionToolProps) {
  const result = useMemo(() => {
    if (!draft) return null;
    return analyzeConfidentialMode(draft);
  }, [draft]);

  if (loading) {
    return <ConfidentialModeSuggestionLoadingState />;
  }

  if (error) {
    return <ConfidentialModeSuggestionErrorState details={error} />;
  }

  if (!draft || !result) {
    return <ConfidentialModeSuggestionEmptyState />;
  }

  const highSeverityCount = result.suggestions.filter((item) => item.severity === "high").length;

  return (
    <section
      aria-labelledby="confidential-mode-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <h1 id="confidential-mode-title" className="text-2xl font-semibold text-slate-950">
          Confidential Mode Suggestion
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Review privacy recommendations before sending your email.
        </p>
      </header>

      <ConfidentialModeSuggestionSummary
        score={result.score}
        recommendationCount={result.suggestions.length}
        highSeverityCount={highSeverityCount}
      />

      {result.suggestions.length > 0 ? (
        <div role="list" aria-label="Privacy recommendations" className="space-y-3">
          {result.suggestions.map((suggestion) => (
            <div key={suggestion.id} role="listitem">
              <ConfidentialModeRecommendationCard suggestion={suggestion} />
            </div>
          ))}
        </div>
      ) : (
        <ConfidentialModeSuggestionEmptyState
          title="No recommendations"
          description="This draft does not currently require additional confidential mode recommendations."
        />
      )}
    </section>
  );
}

export type { ConfidentialModeSuggestionToolProps };
