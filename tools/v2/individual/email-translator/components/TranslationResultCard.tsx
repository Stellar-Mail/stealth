import { CheckCircle2, FileQuestion, ShieldAlert } from "lucide-react";
import type { EmailTranslationResult } from "../types";
import { CopyTranslationButton } from "./CopyTranslationButton";

interface TranslationResultCardProps {
  onCopy?: (text: string) => void;
  onReviewTranslation?: (result: EmailTranslationResult) => void;
  result: EmailTranslationResult;
}

const statusStyles: Record<EmailTranslationResult["status"], string> = {
  translated: "border-emerald-200 bg-emerald-50 text-emerald-800",
  "needs-review": "border-amber-200 bg-amber-50 text-amber-800",
  blocked: "border-red-200 bg-red-50 text-red-800",
};

const statusIcons = {
  translated: CheckCircle2,
  "needs-review": FileQuestion,
  blocked: ShieldAlert,
};

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% confidence`;
}

export function TranslationResultCard({
  onCopy,
  onReviewTranslation,
  result,
}: TranslationResultCardProps) {
  const StatusIcon = statusIcons[result.status];
  const shouldReview = result.status !== "translated";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div
          aria-hidden="true"
          className={`flex size-10 shrink-0 items-center justify-center rounded-md border ${statusStyles[result.status]}`}
        >
          <StatusIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">
              {result.subject}
            </h3>
            <span
              className={`rounded-md border px-2 py-1 text-xs font-medium ${statusStyles[result.status]}`}
            >
              {result.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-700">
            {result.sourceLanguage.toUpperCase()} to {result.targetLanguage.toUpperCase()} ·{" "}
            {formatConfidence(result.confidence)}
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Source
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {result.sourceText}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Translation
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                {result.translatedText}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">
            {result.preservedElements.map((item) => (
              <span className="rounded-md bg-slate-100 px-2 py-1" key={item}>
                Preserved {item}
              </span>
            ))}
            {result.warnings.map((warning) => (
              <span className="rounded-md bg-amber-100 px-2 py-1 text-amber-800" key={warning}>
                {warning}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 md:flex-col">
          {result.status !== "blocked" ? (
            <CopyTranslationButton
              label={`Copy ${result.subject} translation`}
              onCopy={onCopy}
              text={result.translatedText}
            />
          ) : null}
          {onReviewTranslation && shouldReview ? (
            <button
              aria-label={`Review translation for ${result.subject}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onReviewTranslation(result)}
              type="button"
            >
              Review
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export type { TranslationResultCardProps };
