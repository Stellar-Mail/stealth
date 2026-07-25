import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Language } from "../types";
import { getLanguageDisplayName } from "../services";

interface LanguageSelectorProps {
  id: string;
  label: string;
  languages: Language[];
  selectedLanguage: string | null;
  onLanguageChange: (languageCode: string) => void;
  disabled?: boolean;
}

/**
 * Accessible language selector with keyboard navigation.
 */
export function LanguageSelector({
  id,
  label,
  languages,
  selectedLanguage,
  onLanguageChange,
  disabled = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLanguageObj = languages.find((lang) => lang.code === selectedLanguage);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node) &&
        listRef.current &&
        !listRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;

    switch (event.key) {
      case "Enter":
      case " ":
        if (!isOpen) {
          event.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        } else if (focusedIndex >= 0) {
          event.preventDefault();
          onLanguageChange(languages[focusedIndex].code);
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case "Escape":
        if (isOpen) {
          event.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex((prev) => (prev < languages.length - 1 ? prev + 1 : 0));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) {
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : languages.length - 1));
        }
        break;
      case "Home":
        if (isOpen) {
          event.preventDefault();
          setFocusedIndex(0);
        }
        break;
      case "End":
        if (isOpen) {
          event.preventDefault();
          setFocusedIndex(languages.length - 1);
        }
        break;
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[focusedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex, isOpen]);

  return (
    <div className="relative">
      <label className="mb-2 block text-sm font-medium text-slate-900" htmlFor={id}>
        {label}
      </label>
      <button
        ref={buttonRef}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={`${id}-label`}
        className="relative w-full rounded-md border border-slate-300 bg-white px-4 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id={id}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        type="button"
      >
        <span className="block truncate">
          {selectedLanguageObj ? getLanguageDisplayName(selectedLanguageObj) : "Select language"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          aria-labelledby={`${id}-label`}
          className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-lg"
          role="listbox"
          tabIndex={-1}
        >
          {languages.map((language, index) => {
            const isSelected = language.code === selectedLanguage;
            const isFocused = index === focusedIndex;

            return (
              <li
                key={language.code}
                aria-selected={isSelected}
                className={`relative cursor-pointer select-none px-4 py-2.5 pr-10 text-sm transition-colors ${
                  isFocused ? "bg-slate-100 text-slate-900" : "text-slate-700"
                } ${isSelected ? "font-medium" : "font-normal"}`}
                onClick={() => {
                  onLanguageChange(language.code);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                role="option"
              >
                <span className="block truncate">{getLanguageDisplayName(language)}</span>
                {isSelected && (
                  <Check
                    aria-hidden="true"
                    className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-950"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export type { LanguageSelectorProps };
