import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import type { ConfidentialSuggestion, ConfidentialSuggestionSeverity } from "../types";

interface ConfidentialModeRecommendationCardProps {
  suggestion: ConfidentialSuggestion;
}

const severityConfig: Record<
  ConfidentialSuggestionSeverity,
  {
    icon: typeof ShieldCheck;
    badge: string;
  }
> = {
  high: {
    icon: AlertTriangle,
    badge: "bg-red-100 text-red-800 border-red-200",
  },
  medium: {
    icon: Info,
    badge: "bg-amber-100 text-amber-800 border-amber-200",
  },
  low: {
    icon: ShieldCheck,
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
};

export function ConfidentialModeRecommendationCard({
  suggestion,
}: ConfidentialModeRecommendationCardProps) {
  const config = severityConfig[suggestion.severity];
  const Icon = config.icon;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className={`flex size-10 items-center justify-center rounded-md border ${config.badge}`}
        >
          <Icon className="size-5" />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{suggestion.title}</h3>

            <span className={`rounded border px-2 py-1 text-xs font-medium ${config.badge}`}>
              {suggestion.severity}
            </span>
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">{suggestion.description}</p>

          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">
            {suggestion.category}
          </p>
        </div>
      </div>
    </article>
  );
}

export type { ConfidentialModeRecommendationCardProps };
