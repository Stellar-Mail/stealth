import { useState } from "react";
import type {
  InboxRule,
  CreateRuleInput,
  UpdateRuleInput,
  Condition,
  ConditionGroup,
  RuleAction,
  RuleActionType,
  ConditionField,
  ConditionOperator,
} from "../types";

const CONDITION_FIELDS: ConditionField[] = [
  "from", "to", "subject", "body", "priority", "hasAttachments",
  "receivedAfter", "receivedBefore", "label", "customHeader",
];

const CONDITION_OPERATORS: ConditionOperator[] = [
  "equals", "contains", "startsWith", "endsWith", "matches",
  "greaterThan", "lessThan", "exists", "notExists",
];

const ACTION_TYPES: RuleActionType[] = [
  "fileToFolder", "forwardTo", "markAs", "flag", "notify", "autoReply", "addLabel", "delete",
];

function newCondition(): Condition {
  return { id: crypto.randomUUID(), field: "from", operator: "contains", value: "" };
}

function newGroup(): ConditionGroup {
  return { id: crypto.randomUUID(), logic: "and", conditions: [newCondition()] };
}

function newAction(): RuleAction {
  return { id: crypto.randomUUID(), type: "flag", config: {} };
}

interface RuleBuilderProps {
  rule?: InboxRule;
  onSave?: (input: CreateRuleInput | UpdateRuleInput) => void;
  onCancel?: () => void;
}

export function RuleBuilder({ rule, onSave, onCancel }: RuleBuilderProps) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [priority, setPriority] = useState(rule?.priority ?? 1);
  const [groups, setGroups] = useState<ConditionGroup[]>(
    rule?.conditionGroups ?? [newGroup()],
  );
  const [actions, setActions] = useState<RuleAction[]>(rule?.actions ?? [newAction()]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave?.({ name, description, priority, conditionGroups: groups, actions });
  }

  function updateCondition(groupId: string, condId: string, patch: Partial<Condition>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, conditions: g.conditions.map((c) => (c.id !== condId ? c : { ...c, ...patch })) },
      ),
    );
  }

  function removeCondition(groupId: string, condId: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.id !== groupId
          ? g
          : { ...g, conditions: g.conditions.filter((c) => c.id !== condId) },
      ),
    );
  }

  function updateAction(actionId: string, patch: Partial<RuleAction>) {
    setActions((prev) => prev.map((a) => (a.id !== actionId ? a : { ...a, ...patch })));
  }

  return (
    <form onSubmit={handleSubmit} aria-label={rule ? "Edit rule" : "Create rule"} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold mb-1">Rule details</legend>
        <label className="flex flex-col gap-1 text-sm">
          Name <span aria-hidden="true" className="text-destructive">*</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Flag high priority from VIP"
            className="rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
            aria-required="true"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            className="rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Priority
          <input
            type="number"
            min={1}
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-24 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
          />
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold mb-1">Conditions</legend>
        {groups.map((group, gi) => (
          <div key={group.id} className="rounded-lg border p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span>Match</span>
              <select
                value={group.logic}
                onChange={(e) =>
                  setGroups((prev) =>
                    prev.map((g) => (g.id === group.id ? { ...g, logic: e.target.value as "and" | "or" } : g)),
                  )
                }
                aria-label={`Group ${gi + 1} logic`}
                className="rounded border px-2 py-1 text-xs"
              >
                <option value="and">ALL</option>
                <option value="or">ANY</option>
              </select>
              <span>conditions</span>
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => setGroups((prev) => prev.filter((g) => g.id !== group.id))}
                  aria-label={`Remove group ${gi + 1}`}
                  className="ml-auto text-destructive text-xs"
                >
                  Remove group
                </button>
              )}
            </div>
            {group.conditions.map((cond) => (
              <div key={cond.id} className="flex flex-wrap gap-2 items-center">
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(group.id, cond.id, { field: e.target.value as ConditionField })}
                  aria-label="Condition field"
                  className="rounded border px-2 py-1 text-xs"
                >
                  {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  value={cond.operator}
                  onChange={(e) => updateCondition(group.id, cond.id, { operator: e.target.value as ConditionOperator })}
                  aria-label="Condition operator"
                  className="rounded border px-2 py-1 text-xs"
                >
                  {CONDITION_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
                <input
                  value={cond.value}
                  onChange={(e) => updateCondition(group.id, cond.id, { value: e.target.value })}
                  placeholder="value"
                  aria-label="Condition value"
                  className="rounded border px-2 py-1 text-xs flex-1 min-w-[80px]"
                />
                {group.conditions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCondition(group.id, cond.id)}
                    aria-label="Remove condition"
                    className="text-destructive text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setGroups((prev) =>
                  prev.map((g) => (g.id === group.id ? { ...g, conditions: [...g.conditions, newCondition()] } : g)),
                )
              }
              className="text-primary text-xs self-start"
            >
              + Add condition
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setGroups((prev) => [...prev, newGroup()])}
          className="text-primary text-xs self-start"
        >
          + Add condition group
        </button>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold mb-1">Actions</legend>
        {actions.map((action) => (
          <div key={action.id} className="flex gap-2 items-center">
            <select
              value={action.type}
              onChange={(e) => updateAction(action.id, { type: e.target.value as RuleActionType })}
              aria-label="Action type"
              className="rounded border px-2 py-1 text-xs"
            >
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {actions.length > 1 && (
              <button
                type="button"
                onClick={() => setActions((prev) => prev.filter((a) => a.id !== action.id))}
                aria-label="Remove action"
                className="text-destructive text-xs"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setActions((prev) => [...prev, newAction()])}
          className="text-primary text-xs self-start"
        >
          + Add action
        </button>
      </fieldset>

      <div className="flex gap-3 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          {rule ? "Save changes" : "Create rule"}
        </button>
      </div>
    </form>
  );
}
