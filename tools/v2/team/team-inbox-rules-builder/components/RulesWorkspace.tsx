import { useEffect, useState } from "react";
import type { InboxRule, RuleId, CreateRuleInput, UpdateRuleInput } from "../types";
import { useRules } from "../hooks";
import { RuleList } from "./RuleList";
import { RuleBuilder } from "./RuleBuilder";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";

type View = { mode: "list" } | { mode: "new" } | { mode: "edit"; id: RuleId };

interface RulesWorkspaceProps {
  initialRules?: InboxRule[];
}

/**
 * Top-level, self-contained UI surface for the Team Inbox Rules Builder.
 * Wires the four required states (empty / loading / error / success) to the
 * rule list and builder. Not mounted in the main app — it is the tool's local
 * surface. Announcements are routed through a single polite live region.
 */
export function RulesWorkspace({ initialRules }: RulesWorkspaceProps) {
  const { rules, isLoading, error, fetchRules, addRule, updateRule, toggleRule, clearError } =
    useRules({ initialRules });

  const [view, setView] = useState<View>({ mode: "list" });
  const [selected, setSelected] = useState<InboxRule | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialRules) void fetchRules();
  }, [initialRules, fetchRules]);

  const editing = view.mode === "edit" ? (rules.find((r) => r.id === view.id) ?? null) : null;

  const handleSave = async (input: CreateRuleInput | UpdateRuleInput) => {
    if (view.mode === "new") {
      await addRule(input as CreateRuleInput);
      setSuccessMessage("Rule created.");
    } else if (view.mode === "edit") {
      await updateRule(view.id, input as UpdateRuleInput);
      setSuccessMessage("Rule updated.");
    }
    setView({ mode: "list" });
    setSelected(null);
  };

  const handleSelect = (id: RuleId) => {
    const rule = rules.find((r) => r.id === id) ?? null;
    setSelected(rule);
    setView({ mode: "edit", id });
  };

  if (isLoading) return <LoadingState message="Loading rules..." />;
  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          clearError();
          void fetchRules();
        }}
      />
    );
  }
  if (rules.length === 0 && view.mode === "list") {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState onNewRule={() => setView({ mode: "new" })} />
      </div>
    );
  }

  return (
    <section aria-label="Team Inbox Rules Builder" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inbox Rules</h1>
        {view.mode === "list" && (
          <button
            type="button"
            onClick={() => setView({ mode: "new" })}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          >
            New rule
          </button>
        )}
        {view.mode !== "list" && (
          <button
            type="button"
            onClick={() => {
              setView({ mode: "list" });
              setSelected(null);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition-colors"
          >
            Back to list
          </button>
        )}
      </header>

      {successMessage && (
        <div role="status" aria-live="polite" className="text-green-600 text-sm">
          {successMessage}
        </div>
      )}

      {view.mode === "list" ? (
        <RuleList
          rules={rules}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          onToggle={(id) => void toggleRule(id)}
        />
      ) : (
        <RuleBuilder
          rule={editing}
          onSave={(input) => void handleSave(input)}
          onCancel={() => {
            setView({ mode: "list" });
            setSelected(null);
          }}
        />
      )}
    </section>
  );
}
