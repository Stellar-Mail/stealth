import { useState, useCallback, useRef, useEffect } from "react";
import type { InboxRule, CreateRuleInput, UpdateRuleInput, RuleId } from "../types";
import { useRules } from "../hooks";
import { mockRules } from "../fixtures/rules.fixtures";
import { RuleBuilder } from "./rule-builder";
import { RuleList } from "./rule-list";
import { EmptyState } from "./empty-state";
import { LoadingState } from "./loading-state";
import { ErrorState } from "./error-state";
import { SuccessState } from "./success-state";

type View = "list" | "create" | "edit";

interface SuccessMessage {
  text: string;
}

export interface TeamInboxRulesBuilderProps {
  /** Seed rules for the initial session. Defaults to fixture data. */
  initialRules?: InboxRule[];
}

/**
 * TeamInboxRulesBuilder
 *
 * Top-level UI surface for the Team Inbox Rules Builder tool.
 * Manages view state (list → create/edit → success), coordinates the
 * useRules hook with the RuleList and RuleBuilder components, and
 * handles all keyboard, focus, and screen-reader requirements.
 *
 * Accessibility highlights:
 * - heading hierarchy: h1 (tool title) › h2 (section)
 * - focus returns to the "New rule" trigger after cancel or save
 * - role="status" / aria-live regions for loading and success
 * - role="alert" for errors
 * - Escape key closes builder; Ctrl+S submits the form
 */
export function TeamInboxRulesBuilder({ initialRules = mockRules }: TeamInboxRulesBuilderProps) {
  const { rules, isLoading, error, addRule, updateRule, deleteRule, toggleRule, clearError } =
    useRules({ initialRules });

  const [view, setView] = useState<View>("list");
  const [editingRule, setEditingRule] = useState<InboxRule | null>(null);
  const [successMsg, setSuccessMsg] = useState<SuccessMessage | null>(null);

  // Refs for focus management
  const newRuleBtnRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Return focus to the "New rule" button after builder closes
  const closeBuilder = useCallback(() => {
    setView("list");
    setEditingRule(null);
    requestAnimationFrame(() => newRuleBtnRef.current?.focus());
  }, []);

  const handleNewRule = useCallback(() => {
    setEditingRule(null);
    setSuccessMsg(null);
    clearError();
    setView("create");
  }, [clearError]);

  const handleEdit = useCallback(
    (rule: InboxRule) => {
      setSuccessMsg(null);
      clearError();
      setEditingRule(rule);
      setView("edit");
    },
    [clearError],
  );

  const handleSave = useCallback(
    async (input: CreateRuleInput | UpdateRuleInput) => {
      if (view === "edit" && editingRule) {
        await updateRule(editingRule.id, input as UpdateRuleInput);
        setSuccessMsg({ text: `Rule "${editingRule.name}" updated.` });
      } else {
        const created = await addRule(input as CreateRuleInput);
        if (created) setSuccessMsg({ text: `Rule "${created.name}" created.` });
      }
      setView("list");
      setEditingRule(null);
      requestAnimationFrame(() => newRuleBtnRef.current?.focus());
    },
    [view, editingRule, addRule, updateRule],
  );

  const handleDelete = useCallback(
    async (id: RuleId) => {
      const target = rules.find((r) => r.id === id);
      await deleteRule(id);
      if (target) setSuccessMsg({ text: `Rule "${target.name}" deleted.` });
    },
    [rules, deleteRule],
  );

  const handleToggle = useCallback(
    async (id: RuleId) => {
      const updated = await toggleRule(id);
      if (updated) {
        setSuccessMsg({
          text: `Rule "${updated.name}" ${updated.enabled ? "enabled" : "disabled"}.`,
        });
      }
    },
    [toggleRule],
  );

  // Escape key closes the builder
  useEffect(() => {
    if (view === "list") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeBuilder();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, closeBuilder]);

  // Auto-clear success banner after 4 s
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const inBuilder = view === "create" || view === "edit";

  return (
    <div className="tirb-root" data-testid="team-inbox-rules-builder">
      {/* ── Tool header ── */}
      <header className="tirb-header">
        <h1 ref={headingRef} className="tirb-title" tabIndex={-1}>
          Team Inbox Rules Builder
        </h1>
        {!inBuilder && (
          <button
            ref={newRuleBtnRef}
            onClick={handleNewRule}
            className="tirb-btn-primary"
            aria-label="Create new inbox rule"
          >
            + New Rule
          </button>
        )}
      </header>

      {/* ── Notification bar ── */}
      {successMsg && (
        <SuccessState
          message={successMsg.text}
          onDismiss={() => setSuccessMsg(null)}
        />
      )}

      {error && !inBuilder && (
        <ErrorState message={error} onRetry={clearError} />
      )}

      {/* ── Main content ── */}
      <main className="tirb-main">
        {isLoading && !inBuilder ? (
          <LoadingState />
        ) : inBuilder ? (
          <section aria-labelledby="tirb-builder-heading">
            <h2 id="tirb-builder-heading" className="tirb-section-heading">
              {view === "edit" ? "Edit Rule" : "New Rule"}
            </h2>
            <RuleBuilder
              rule={editingRule ?? undefined}
              onSave={handleSave}
              onCancel={closeBuilder}
            />
          </section>
        ) : rules.length === 0 ? (
          <EmptyState onNewRule={handleNewRule} />
        ) : (
          <section aria-labelledby="tirb-list-heading">
            <h2 id="tirb-list-heading" className="tirb-section-heading">
              Rules
              <span className="tirb-rule-count" aria-label={`${rules.length} rules`}>
                {rules.length}
              </span>
            </h2>
            <RuleList
              rules={rules}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          </section>
        )}
      </main>
    </div>
  );
}
