import { useState } from "react";
import type {
  ConditionField,
  ConditionOperator,
  GroupLogic,
  InboxRule,
  RuleActionType,
  CreateRuleInput,
  UpdateRuleInput,
} from "../types";

interface RuleBuilderProps {
  rule?: InboxRule | null;
  onSave: (input: CreateRuleInput | UpdateRuleInput) => void;
  onCancel: () => void;
  "aria-label"?: string;
}

const FIELDS: ConditionField[] = [
  "from",
  "to",
  "subject",
  "body",
  "priority",
  "hasAttachments",
  "receivedAfter",
  "receivedBefore",
  "label",
  "customHeader",
];
const OPERATORS: ConditionOperator[] = [
  "equals",
  "contains",
  "startsWith",
  "endsWith",
  "matches",
  "greaterThan",
  "lessThan",
  "exists",
  "notExists",
];
const ACTIONS: RuleActionType[] = [
  "fileToFolder",
  "forwardTo",
  "markAs",
  "flag",
  "notify",
  "autoReply",
  "addLabel",
  "delete",
];

/**
 * Accessible create/edit form for an inbox rule.
 * - Fieldset/legend grouping; every control has a <label> + aria-label.
 * - Inline validation messages tied via aria-describedby.
 * - Ctrl+S saves; Escape cancels.
 */
export function RuleBuilder({
  rule,
  onSave,
  onCancel,
  "aria-label": ariaLabel = "Rule builder",
}: RuleBuilderProps) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [enabled, setEnabled] = useState(rule?.enabled ?? true);
  const [priority, setPriority] = useState(String(rule?.priority ?? 0));
  const [field, setField] = useState<ConditionField>("from");
  const [operator, setOperator] = useState<ConditionOperator>("contains");
  const [value, setValue] = useState("");
  const [action, setAction] = useState<RuleActionType>("fileToFolder");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");

  const validate = (): CreateRuleInput | UpdateRuleInput | null => {
    const next: Record<string, string> = {};
    if (name.trim().length === 0) next.name = "Rule name is required.";
    const priorityNum = Number(priority);
    if (!Number.isFinite(priorityNum) || priorityNum < 0) {
      next.priority = "Priority must be a non-negative number.";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setAnnouncement(Object.values(next).join(" "));
      return null;
    }
    return {
      name: name.trim(),
      description: description.trim(),
      enabled,
      priority: priorityNum,
      conditionGroups: [
        {
          id: "cg-1",
          logic: "and" as GroupLogic,
          conditions: [{ id: "c-1", field, operator, value }],
        },
      ],
      actions: [{ id: "a-1", type: action, config: {} }],
    };
  };

  const handleSave = () => {
    const input = validate();
    if (input) {
      setAnnouncement(`Rule ${name.trim()} saved.`);
      onSave(input);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="flex flex-col gap-4"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Rule details</legend>

        <div className="flex flex-col gap-1">
          <label htmlFor="rule-name" className="text-xs font-medium">
            Name
          </label>
          <input
            id="rule-name"
            type="text"
            value={name}
            aria-required="true"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "rule-name-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
          {errors.name && (
            <p id="rule-name-error" role="alert" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="rule-description" className="text-xs font-medium">
            Description
          </label>
          <textarea
            id="rule-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-md border border-border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="rule-priority" className="text-xs font-medium">
              Priority
            </label>
            <input
              id="rule-priority"
              type="number"
              min={0}
              value={priority}
              aria-invalid={Boolean(errors.priority)}
              aria-describedby={errors.priority ? "rule-priority-error" : undefined}
              onChange={(e) => setPriority(e.target.value)}
              className="w-24 rounded-md border border-border px-3 py-2 text-sm"
            />
            {errors.priority && (
              <p id="rule-priority-error" role="alert" className="text-xs text-destructive">
                {errors.priority}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              aria-label="Rule enabled"
            />
            Enabled
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Condition (AND group)</legend>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="cond-field" className="text-xs font-medium">
              Field
            </label>
            <select
              id="cond-field"
              value={field}
              onChange={(e) => setField(e.target.value as ConditionField)}
              className="rounded-md border border-border px-2 py-2 text-sm"
            >
              {FIELDS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cond-operator" className="text-xs font-medium">
              Operator
            </label>
            <select
              id="cond-operator"
              value={operator}
              onChange={(e) => setOperator(e.target.value as ConditionOperator)}
              className="rounded-md border border-border px-2 py-2 text-sm"
            >
              {OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cond-value" className="text-xs font-medium">
              Value
            </label>
            <input
              id="cond-value"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="rounded-md border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Action</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor="rule-action" className="text-xs font-medium">
            Action type
          </label>
          <select
            id="rule-action"
            value={action}
            onChange={(e) => setAction(e.target.value as RuleActionType)}
            className="w-48 rounded-md border border-border px-2 py-2 text-sm"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Save rule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </form>
  );
}
