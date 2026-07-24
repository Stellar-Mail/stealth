import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface TranslationOutputProps {
  text: string;
  sourceLanguage?: string;
  targetLanguage?: string;
}

/**
 * Displays translated text with copy-to-clipboard functionality.
 */
export function TranslationOutput({
  text,
  sourceLanguage,
  targetLanguage,
}: TranslationOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-slate-900" htmlFor="translation-output">
          Translated text
        </label>
        <button
          aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
          onClick={handleCopy}
          type="button"
        >
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <div
        aria-describedby="translation-output-description"
        aria-label="Translated text content"
        className="min-h-[200px] w-full overflow-auto rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900"
        id="translation-output"
        role="textbox"
        tabIndex={0}
      >
        {text}
      </div>
      {sourceLanguage && targetLanguage && (
        <p className="mt-2 text-xs text-slate-600" id="translation-output-description">
          Translated from {sourceLanguage} to {targetLanguage}
        </p>
      )}
    </div>
  );
}

export type { TranslationOutputProps };
