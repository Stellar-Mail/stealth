import type { TranslatorLanguage } from "../types";

interface LanguageSelectorProps {
  description?: string;
  id: string;
  label: string;
  languages: TranslatorLanguage[];
  onChange?: (languageCode: string) => void;
  value: string;
}

export function LanguageSelector({
  description,
  id,
  label,
  languages,
  onChange,
  value,
}: LanguageSelectorProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className="min-w-0 flex-1">
      <label className="text-sm font-medium text-slate-800" htmlFor={id}>
        {label}
      </label>
      {description ? (
        <p className="mt-1 text-xs leading-5 text-slate-500" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <select
        aria-describedby={descriptionId}
        className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        id={id}
        onChange={(event) => onChange?.(event.target.value)}
        value={value}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.label}
            {language.nativeLabel ? ` (${language.nativeLabel})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export type { LanguageSelectorProps };
