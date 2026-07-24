import { AlertCircle, AlertTriangle, Info, Lightbulb } from "lucide-react";
import type { DraftIssue, DraftIssueSeverity } from "../types";

interface DraftIssueCardProps {
  issue: DraftIssue;
}

const severityConfig: Record<
  DraftIssueSeverity,
  { icon: typeof AlertCircle; border: string; bg: string; text: string }
> = {
  error: {
    icon: AlertCircle,
    border: "border-red-200 bg-red-50 text-red-800",
    bg: "bg-red-100",
    text: "text-red-800",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-amber-200 bg-amber-50 text-amber-800",
    bg: "bg-amber-100",
    text: "text-amber-800",
  },
  info: {
    icon: Info,
    border: "border-blue-200 bg-blue-50 text-blue-800",
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
};

const categoryLabels: Record<string, string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  clarity: "Clarity",
  tone: "Tone",
  length: "Length",
  structure: "Structure",
  "action-item": "Action Item",
  "missing-field": "Missing Field",
  "sensitive-content": "Sensitive Content",
};

export function DraftIssueCard({ issue }: DraftIssueCardProps) {
  const config = severityConfig[issue.severity];
  const SeverityIcon = config.icon;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md border ${config.border}`}
        >
          <SeverityIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md border px-2 py-1 text-xs font-medium ${config.border}`}>
              {issue.severity}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              {categoryLabels[issue.category] ?? issue.category}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{issue.message}</p>
        </div>
      </div>

      {issue.suggestions.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {issue.suggestions.map((suggestion, index) => (
            <div className="flex items-start gap-2 text-sm" key={index}>
              <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="text-slate-600">
                <span className="font-medium text-slate-800">Suggestion:</span> {suggestion.message}
                {suggestion.originalText && (
                  <span className="block mt-1 rounded bg-slate-100 px-2 py-1 text-slate-700">
                    Original: &ldquo;{suggestion.originalText}&rdquo;
                  </span>
                )}
                {suggestion.suggestedText && (
                  <span className="block mt-1 rounded bg-green-50 px-2 py-1 text-green-800">
                    Suggestion: &ldquo;{suggestion.suggestedText}&rdquo;
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export type { DraftIssueCardProps };
