import { cn } from "@/lib/utils";
import type { TagColorKey } from "../types/campaignTag";
import { TAG_COLOR_TOKENS } from "../constants/displayTokens";

const COLOR_KEYS: TagColorKey[] = [
  "onboarding",
  "welcome",
  "stellar",
  "security",
  "alert",
  "newsletter",
  "marketing",
  "announcement",
];

interface TagColorSelectorProps {
  value: TagColorKey;
  onChange: (color: TagColorKey) => void;
}

export function TagColorSelector({ value, onChange }: TagColorSelectorProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_KEYS.map((key) => {
        const token = TAG_COLOR_TOKENS[key];
        const isSelected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={token.label}
            aria-label={`${token.label} color`}
            aria-pressed={isSelected}
            onClick={() => onChange(key)}
            className={cn(
              "h-6 w-6 rounded-full border transition",
              token.bg,
              token.border,
              isSelected
                ? "ring-2 ring-white ring-offset-1 ring-offset-black"
                : "opacity-60 hover:opacity-100",
            )}
          />
        );
      })}
    </div>
  );
}
