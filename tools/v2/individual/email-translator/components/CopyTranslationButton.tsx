import { Check, Copy } from "lucide-react";
import { useState } from "react";

interface CopyTranslationButtonProps {
  label?: string;
  onCopy?: (text: string) => void;
  text: string;
}

export function CopyTranslationButton({
  label = "Copy translation",
  onCopy,
  text,
}: CopyTranslationButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    onCopy?.(text);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      aria-live="polite"
      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4 text-emerald-700" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

export type { CopyTranslationButtonProps };
