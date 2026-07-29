import { useRef } from "react";
import type { InboxRule, RuleId } from "../types";

interface RuleListProps {
  rules: InboxRule[];
  selectedId?: RuleId | null;
  onSelect: (id: RuleId) => void;
  onToggle?: (id: RuleId) => void;
  "aria-label"?: string;
}

/**
 * Accessible, keyboard-navigable list of inbox rules.
 * - Roving focus via ArrowUp/Down; Enter/Space activates (selects) a rule.
 * - Each row is a button with a descriptive aria-label (name + enabled state).
 * - Status is conveyed by text + icon, never color alone.
 */
export function RuleList({
  rules,
  selectedId,
  onSelect,
  onToggle,
  "aria-label": ariaLabel = "Inbox rules",
}: RuleListProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusItem = (index: number) => {
    const clamped = Math.max(0, Math.min(rules.length - 1, index));
    itemRefs.current[clamped]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(rules.length - 1);
    }
  };

  if (rules.length === 0) return null;

  return (
    <ul role="list" aria-label={ariaLabel} className="flex flex-col gap-2">
      {rules.map((rule, index) => {
        const status = rule.enabled ? "Active" : "Inactive";
        const label = `${rule.name}, ${status}, priority ${rule.priority}. Press Enter to edit.`;
        return (
          <li role="listitem" key={rule.id}>
            <button
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              aria-label={label}
              aria-pressed={selectedId === rule.id}
              onClick={() => onSelect(rule.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors ${
                selectedId === rule.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{rule.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {rule.description || "No description"}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    rule.enabled
                      ? "bg-green-500/15 text-green-600"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {status}
                </span>
                {onToggle && (
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(rule.id);
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
