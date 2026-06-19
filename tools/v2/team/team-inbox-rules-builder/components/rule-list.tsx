import type { InboxRule, RuleId } from "../types";

interface RuleListProps {
  rules: InboxRule[];
  onEdit?: (rule: InboxRule) => void;
  onDelete?: (id: RuleId) => void;
  onToggle?: (id: RuleId) => void;
}

export function RuleList({ rules, onEdit, onDelete, onToggle }: RuleListProps) {
  return (
    <ul role="list" aria-label="Inbox rules" className="flex flex-col gap-2">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className="flex items-start justify-between rounded-lg border p-4 gap-4"
          aria-label={`Rule: ${rule.name}`}
        >
          <div className="flex items-start gap-3 min-w-0">
            <button
              role="switch"
              aria-checked={rule.enabled}
              aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
              onClick={() => onToggle?.(rule.id)}
              className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                rule.enabled ? "bg-primary" : "bg-input"
              }`}
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{rule.name}</p>
              {rule.description && (
                <p className="text-muted-foreground truncate text-xs mt-0.5">{rule.description}</p>
              )}
              <p className="text-muted-foreground text-xs mt-1">
                Priority {rule.priority} · {rule.conditionGroups.length} condition group
                {rule.conditionGroups.length !== 1 ? "s" : ""} · {rule.actions.length} action
                {rule.actions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(rule)}
                aria-label={`Edit rule ${rule.name}`}
                className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(rule.id)}
                aria-label={`Delete rule ${rule.name}`}
                className="text-destructive hover:text-destructive/80 rounded px-2 py-1 text-xs transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
