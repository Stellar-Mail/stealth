import { useMemo, useState } from "react";
import { ArrowRightLeft, MailPlus } from "lucide-react";
import type {
  EmailTranslationResult,
  EmailTranslationStatus,
  EmailTranslatorSummary as Summary,
  TranslatorLanguage,
} from "../types";
import { EmailTranslatorEmptyState } from "./EmailTranslatorEmptyState";
import { EmailTranslatorErrorState } from "./EmailTranslatorErrorState";
import { EmailTranslatorLoadingState } from "./EmailTranslatorLoadingState";
import { EmailTranslatorSummary } from "./EmailTranslatorSummary";
import { LanguageSelector } from "./LanguageSelector";
import { TranslationResultCard } from "./TranslationResultCard";

type TranslatorViewState = "loading" | "error" | "ready";
type FilterValue = "all" | EmailTranslationStatus;

interface EmailTranslatorShellProps {
  errorMessage?: string;
  initialState?: TranslatorViewState;
  languages?: TranslatorLanguage[];
  onCopyTranslation?: (text: string) => void;
  onRequestEmailText?: () => void;
  onRequestTranslation?: (sourceLanguage: string, targetLanguage: string) => void;
  onReviewTranslation?: (result: EmailTranslationResult) => void;
  results?: EmailTranslationResult[];
}

const defaultLanguages: TranslatorLanguage[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "de", label: "German", nativeLabel: "Deutsch" },
  { code: "ja", label: "Japanese", nativeLabel: "日本語" },
];

const filterOptions: Array<{ label: string; value: FilterValue }> = [
  { label: "All", value: "all" },
  { label: "Translated", value: "translated" },
  { label: "Review", value: "needs-review" },
  { label: "Blocked", value: "blocked" },
];

function summarizeTranslations(results: EmailTranslationResult[]): Summary {
  return results.reduce(
    (summary, result) => {
      summary.totalTranslations += 1;
      if (result.status === "needs-review") {
        summary.needsReview += 1;
      } else {
        summary[result.status] += 1;
      }
      return summary;
    },
    {
      totalTranslations: 0,
      translated: 0,
      needsReview: 0,
      blocked: 0,
    },
  );
}

export function EmailTranslatorShell({
  errorMessage,
  initialState = "ready",
  languages = defaultLanguages,
  onCopyTranslation,
  onRequestEmailText,
  onRequestTranslation,
  onReviewTranslation,
  results = [],
}: EmailTranslatorShellProps) {
  const [viewState, setViewState] = useState<TranslatorViewState>(initialState);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [filter, setFilter] = useState<FilterValue>("all");

  const summary = useMemo(() => summarizeTranslations(results), [results]);
  const filteredResults = useMemo(
    () => (filter === "all" ? results : results.filter((result) => result.status === filter)),
    [filter, results],
  );

  if (viewState === "loading") {
    return <EmailTranslatorLoadingState />;
  }

  if (viewState === "error") {
    return (
      <EmailTranslatorErrorState details={errorMessage} onRetry={() => setViewState("ready")} />
    );
  }

  if (results.length === 0) {
    return (
      <EmailTranslatorEmptyState
        action={
          onRequestEmailText ? (
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={onRequestEmailText}
              type="button"
            >
              <MailPlus aria-hidden="true" className="size-4" />
              Add email text
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="email-translator-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Individual V2 tool
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="email-translator-title">
          Email Translator
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Preview translated email text, review confidence and warnings, and copy safe results for
          a future compose integration.
        </p>
      </header>

      <EmailTranslatorSummary summary={summary} />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <LanguageSelector
            description="Use auto-detect when the source language is unknown."
            id="email-translator-source-language"
            label="Source language"
            languages={languages}
            onChange={setSourceLanguage}
            value={sourceLanguage}
          />
          <div
            aria-hidden="true"
            className="hidden size-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500 md:flex"
          >
            <ArrowRightLeft className="size-4" />
          </div>
          <LanguageSelector
            description="Choose the language for the translated email body."
            id="email-translator-target-language"
            label="Target language"
            languages={languages.filter((language) => language.code !== "auto")}
            onChange={setTargetLanguage}
            value={targetLanguage}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Translation result filter</legend>
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
                  name="email-translator-filter"
                  onChange={() => setFilter(option.value)}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          {onRequestTranslation ? (
            <button
              aria-label={`Translate email from ${sourceLanguage} to ${targetLanguage}`}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={() => onRequestTranslation(sourceLanguage, targetLanguage)}
              type="button"
            >
              <ArrowRightLeft aria-hidden="true" className="size-4" />
              Translate
            </button>
          ) : null}
        </div>
      </div>

      {filteredResults.length > 0 ? (
        <div aria-label="Email translation results" className="space-y-3" role="list">
          {filteredResults.map((result) => (
            <div key={result.id} role="listitem">
              <TranslationResultCard
                onCopy={onCopyTranslation}
                onReviewTranslation={onReviewTranslation}
                result={result}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmailTranslatorEmptyState
          description="No translations match the current filter. Choose another status to continue reviewing."
          title="No matching translations"
        />
      )}
    </section>
  );
}

export { defaultLanguages, summarizeTranslations };
export type { EmailTranslatorShellProps };
