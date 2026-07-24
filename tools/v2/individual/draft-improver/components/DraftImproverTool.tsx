import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import { analyzeDraft } from "../services";
import type {
  DraftImprovementResult,
  DraftIssueCategory,
  DraftIssueSeverity,
  DraftInput,
} from "../types";
import { DraftImproverEmptyState } from "./DraftImproverEmptyState";
import { DraftImproverErrorState } from "./DraftImproverErrorState";
import { DraftImproverLoadingState } from "./DraftImproverLoadingState";
import { DraftImproverSummary } from "./DraftImproverSummary";
import { DraftIssueCard } from "./DraftIssueCard";
import { DraftScoreDisplay } from "./DraftScoreDisplay";

type ViewState = "loading" | "error" | "ready";
type FilterValue = "all" | DraftIssueCategory;
type SeverityFilter = "all" | DraftIssueSeverity;

interface DraftImproverToolProps {
  draft?: DraftInput;
  errorMessage?: string;
  initialState?: ViewState;
  results?: DraftImprovementResult;
  onRequestDraft?: () => void;
  onAnalyzeDraft?: (draft: DraftInput) => void;
}

const categoryLabels: Record<DraftIssueCategory, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  clarity: "Clarity",
  tone: "Tone",
  length: "Length",
  structure: "Structure",
  "action-item": "Action Items",
  "missing-field": "Missing Fields",
  "sensitive-content": "Sensitive Content",
};

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  ...(Object.entries(categoryLabels) as [DraftIssueCategory, string][]).map(([value, label]) => ({
    label,
    value,
  })),
];

const severityOptions: Array<{ label: string; value: SeverityFilter }> = [
  { label: "All", value: "all" },
  { label: "Errors", value: "error" },
  { label: "Warnings", value: "warning" },
  { label: "Info", value: "info" },
];

export function DraftImproverTool({
  draft,
  errorMessage,
  initialState = "ready",
  results: externalResults,
  onRequestDraft,
}: DraftImproverToolProps) {
  const [viewState, setViewState] = useState<ViewState>(initialState);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  const computedResult = useMemo(() => {
    if (externalResults) return externalResults;
    if (!draft) return null;
    const { result, error } = analyzeDraft(draft);
    if (error) return null;
    return result ?? null;
  }, [draft, externalResults]);

  const filteredIssues = useMemo(() => {
    if (!computedResult) return [];
    let issues = computedResult.issues;
    if (filter !== "all") {
      issues = issues.filter((issue) => issue.category === filter);
    }
    if (severityFilter !== "all") {
      issues = issues.filter((issue) => issue.severity === severityFilter);
    }
    return issues;
  }, [computedResult, filter, severityFilter]);

  if (viewState === "loading") {
    return <DraftImproverLoadingState message="Analyzing draft for improvements..." />;
  }

  if (viewState === "error") {
    return <DraftImproverErrorState details={errorMessage} onRetry={() => setViewState("ready")} />;
  }

  if (!draft && !computedResult) {
    return (
      <DraftImproverEmptyState
        action={
          onRequestDraft ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onRequestDraft}
              type="button"
            >
              <FileText aria-hidden="true" className="size-4" />
              Add draft sample
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="draft-improver-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Individual V2 tool
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="draft-improver-title">
            Draft Improver
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Improve draft quality before sending. Detects spelling, tone, clarity, and structural
            issues with actionable suggestions.
          </p>
        </div>
      </header>

      {computedResult && (
        <>
          <DraftScoreDisplay score={computedResult.score} summary={computedResult.summary} />
          <DraftImproverSummary
            totalIssues={computedResult.totalIssues}
            errorCount={computedResult.errorCount}
            warningCount={computedResult.warningCount}
            infoCount={computedResult.infoCount}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Search aria-hidden="true" className="size-4" />
              Filter results
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Issue category filter</legend>
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
                      name="issue-filter"
                      onChange={() => setFilter(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Severity filter</legend>
                {severityOptions.map((option) => (
                  <label
                    className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      severityFilter === option.value
                        ? "border-red-600 bg-red-50 text-red-800"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={severityFilter === option.value}
                      className="sr-only"
                      name="severity-filter"
                      onChange={() => setSeverityFilter(option.value)}
                      type="radio"
                      value={option.value}
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </div>
          </div>

          {filteredIssues.length > 0 ? (
            <div aria-label="Detected draft issues" className="space-y-3" role="list">
              {filteredIssues.map((issue, index) => (
                <div key={`${issue.category}-${index}`} role="listitem">
                  <DraftIssueCard issue={issue} />
                </div>
              ))}
            </div>
          ) : (
            <DraftImproverEmptyState
              description="No issues match the current filter. Choose another category or severity to continue."
              title="No matching issues"
            />
          )}
        </>
      )}
    </section>
  );
}

export type { DraftImproverToolProps };
