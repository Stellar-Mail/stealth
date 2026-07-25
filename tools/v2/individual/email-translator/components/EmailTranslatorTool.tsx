import { useState, useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { SUPPORTED_LANGUAGES, getLanguageByCode } from "../services";
import { useTranslation, useLanguageDetect } from "../hooks";
import { EmailTranslatorEmptyState } from "./EmailTranslatorEmptyState";
import { EmailTranslatorErrorState } from "./EmailTranslatorErrorState";
import { EmailTranslatorLoadingState } from "./EmailTranslatorLoadingState";
import { LanguageSelector } from "./LanguageSelector";
import { TranslationInput } from "./TranslationInput";
import { TranslationOutput } from "./TranslationOutput";

interface EmailTranslatorToolProps {
  sourceText?: string;
  onTranslated?: (translatedText: string) => void;
}

/**
 * Main Email Translator tool component.
 * Provides UI for translating email content between languages.
 */
export function EmailTranslatorTool({ sourceText = "", onTranslated }: EmailTranslatorToolProps) {
  const [inputText, setInputText] = useState(sourceText);
  const [sourceLanguage, setSourceLanguage] = useState<string>("en");
  const [targetLanguage, setTargetLanguage] = useState<string>("es");
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);

  const { translatedText, isTranslating, error, translate, reset } = useTranslation();

  const { detectedLanguage, confidence, isDetecting } = useLanguageDetect({
    text: inputText,
    enabled: autoDetectEnabled,
    debounceMs: 800,
  });

  // Update source language when detected
  useEffect(() => {
    if (autoDetectEnabled && detectedLanguage && confidence && confidence > 0.7) {
      setSourceLanguage(detectedLanguage);
    }
  }, [detectedLanguage, confidence, autoDetectEnabled]);

  // Update input when sourceText prop changes
  useEffect(() => {
    if (sourceText) {
      setInputText(sourceText);
    }
  }, [sourceText]);

  // Notify parent when translation completes
  useEffect(() => {
    if (translatedText && onTranslated) {
      onTranslated(translatedText);
    }
  }, [translatedText, onTranslated]);

  const handleTranslate = () => {
    if (!inputText.trim()) return;
    translate(inputText, sourceLanguage, targetLanguage);
  };

  const handleReset = () => {
    reset();
    setInputText("");
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      handleTranslate();
    }
  };

  if (isTranslating || isDetecting) {
    return (
      <EmailTranslatorLoadingState
        message={isDetecting ? "Detecting language..." : "Translating email..."}
      />
    );
  }

  if (error && !translatedText) {
    return (
      <EmailTranslatorErrorState
        details={error.message}
        onRetry={() => translate(inputText, sourceLanguage, targetLanguage)}
        title="Translation failed"
      />
    );
  }

  return (
    <section
      aria-labelledby="email-translator-title"
      className="mx-auto w-full max-w-5xl space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-4 md:p-6"
    >
      <header>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Individual V2 tool
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950" id="email-translator-title">
            Email Translator
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Translate email content between languages. Automatically detects source language and
            provides accurate translations.
          </p>
        </div>
      </header>

      {!inputText.trim() && !translatedText ? (
        <EmailTranslatorEmptyState />
      ) : (
        <div className="space-y-6">
          {/* Language selection */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Language settings</h2>
              {detectedLanguage && confidence && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                  <Sparkles aria-hidden="true" className="size-3" />
                  Detected: {getLanguageByCode(detectedLanguage)?.name} (
                  {Math.round(confidence * 100)}%)
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <LanguageSelector
                  disabled={autoDetectEnabled}
                  id="source-language"
                  label="From"
                  languages={SUPPORTED_LANGUAGES}
                  onLanguageChange={setSourceLanguage}
                  selectedLanguage={sourceLanguage}
                />
              </div>

              <ArrowRight aria-hidden="true" className="size-5 flex-shrink-0 text-slate-400" />

              <div className="flex-1">
                <LanguageSelector
                  id="target-language"
                  label="To"
                  languages={SUPPORTED_LANGUAGES}
                  onLanguageChange={setTargetLanguage}
                  selectedLanguage={targetLanguage}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  checked={autoDetectEnabled}
                  className="size-4 cursor-pointer rounded border-slate-300 text-slate-950 transition-colors focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
                  onChange={(e) => setAutoDetectEnabled(e.target.checked)}
                  type="checkbox"
                />
                <span className="text-slate-700">Auto-detect source language</span>
              </label>
            </div>
          </div>

          {/* Input area */}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <TranslationInput
              disabled={isTranslating}
              onChange={setInputText}
              onKeyDown={handleKeyPress}
              value={inputText}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              onClick={handleReset}
              type="button"
            >
              Clear all
            </button>
            <button
              aria-keyshortcuts="Control+Enter"
              className="inline-flex items-center gap-2 rounded-md border border-slate-950 bg-slate-950 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!inputText.trim() || sourceLanguage === targetLanguage}
              onClick={handleTranslate}
              type="button"
            >
              Translate
              <span className="text-xs text-slate-400">Ctrl+Enter</span>
            </button>
          </div>

          {/* Translation output */}
          {translatedText && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <TranslationOutput
                sourceLanguage={getLanguageByCode(sourceLanguage)?.name}
                targetLanguage={getLanguageByCode(targetLanguage)?.name}
                text={translatedText}
              />
            </div>
          )}

          {/* Error display (non-blocking) */}
          {error && translatedText && (
            <div
              aria-live="polite"
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              role="alert"
            >
              Note: {error.message}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export type { EmailTranslatorToolProps };
