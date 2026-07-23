interface TranslationInputProps {
  value: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

/**
 * Input area for source text to be translated.
 */
export function TranslationInput({
  value,
  onChange,
  onKeyDown,
  placeholder = "Enter or paste email text to translate...",
  disabled = false,
  readOnly = false,
}: TranslationInputProps) {
  return (
    <div className="flex flex-col">
      <label className="mb-2 text-sm font-medium text-slate-900" htmlFor="translation-input">
        Source text
      </label>
      <textarea
        aria-describedby="translation-input-description"
        className="min-h-[200px] w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-slate-50"
        disabled={disabled}
        id="translation-input"
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value}
      />
      <p className="mt-2 text-xs text-slate-600" id="translation-input-description">
        Enter the email content you want to translate.
      </p>
    </div>
  );
}

export type { TranslationInputProps };
