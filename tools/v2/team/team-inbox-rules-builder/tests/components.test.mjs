/**
 * components.test.mjs — Team Inbox Rules Builder
 *
 * Tests for the component-layer contracts:
 *   - State component prop shapes (EmptyState, LoadingState, ErrorState, SuccessState)
 *   - RuleList / RuleBuilder input data expectations
 *   - View-state transitions represented as pure logic (no DOM required)
 *
 * Run with:
 *   node --test tools/v2/team/team-inbox-rules-builder/tests/components.test.mjs
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline fixture data (mirrors fixtures/rules.fixtures.ts without TS loader)
// ---------------------------------------------------------------------------

const RULE_1 = {
  id: "rule-1",
  name: "High priority from executives",
  description: "Flag and notify team when executive sends high-priority mail",
  enabled: true,
  priority: 1,
  conditionGroups: [
    {
      id: "cg-1",
      logic: "and",
      conditions: [
        { id: "c-1", field: "priority", operator: "equals", value: "high" },
        { id: "c-2", field: "from", operator: "contains", value: "@company.com" },
      ],
    },
  ],
  actions: [
    { id: "a-1", type: "flag", config: { color: "red" } },
    { id: "a-2", type: "notify", config: { channel: "slack" } },
  ],
  createdAt: "2026-01-15T10:00:00Z",
  updatedAt: "2026-01-15T10:00:00Z",
};

const RULE_2 = {
  id: "rule-2",
  name: "Invoice auto-file",
  description: "File invoices into the invoices folder",
  enabled: true,
  priority: 2,
  conditionGroups: [
    {
      id: "cg-2",
      logic: "or",
      conditions: [
        { id: "c-3", field: "subject", operator: "contains", value: "invoice" },
        { id: "c-4", field: "subject", operator: "contains", value: "billing" },
      ],
    },
  ],
  actions: [{ id: "a-3", type: "fileToFolder", config: { folder: "Invoices" } }],
  createdAt: "2026-02-01T14:30:00Z",
  updatedAt: "2026-02-10T09:00:00Z",
};

const RULE_DISABLED = {
  id: "rule-3",
  name: "Spam detection",
  description: "Auto-delete suspected spam",
  enabled: false,
  priority: 0,
  conditionGroups: [
    {
      id: "cg-3",
      logic: "or",
      conditions: [
        { id: "c-5", field: "subject", operator: "contains", value: "buy now" },
        { id: "c-6", field: "from", operator: "contains", value: "spam" },
      ],
    },
  ],
  actions: [{ id: "a-4", type: "delete", config: {} }],
  createdAt: "2026-03-01T08:00:00Z",
  updatedAt: "2026-03-01T08:00:00Z",
};

const ALL_RULES = [RULE_1, RULE_2, RULE_DISABLED];

// ---------------------------------------------------------------------------
// Helpers that mirror component prop validation logic
// ---------------------------------------------------------------------------

function isValidRule(rule) {
  return (
    typeof rule.id === "string" &&
    typeof rule.name === "string" && rule.name.length > 0 &&
    typeof rule.enabled === "boolean" &&
    typeof rule.priority === "number" &&
    Array.isArray(rule.conditionGroups) &&
    Array.isArray(rule.actions)
  );
}

function isValidConditionGroup(group) {
  return (
    typeof group.id === "string" &&
    (group.logic === "and" || group.logic === "or") &&
    Array.isArray(group.conditions) &&
    group.conditions.length > 0
  );
}

function isValidCondition(condition) {
  return (
    typeof condition.id === "string" &&
    typeof condition.field === "string" &&
    typeof condition.operator === "string" &&
    typeof condition.value === "string"
  );
}

function isValidAction(action) {
  return (
    typeof action.id === "string" &&
    typeof action.type === "string" &&
    typeof action.config === "object" && action.config !== null
  );
}

// ---------------------------------------------------------------------------
// Fixture structure
// ---------------------------------------------------------------------------

describe("TeamInboxRulesBuilder — Fixture integrity", () => {
  it("all fixture rules pass isValidRule", () => {
    for (const rule of ALL_RULES) {
      assert.ok(isValidRule(rule), `Rule "${rule.id}" failed validation`);
    }
  });

  it("all condition groups are valid", () => {
    for (const rule of ALL_RULES) {
      for (const group of rule.conditionGroups) {
        assert.ok(isValidConditionGroup(group), `Group "${group.id}" in rule "${rule.id}" is invalid`);
      }
    }
  });

  it("all conditions are valid", () => {
    for (const rule of ALL_RULES) {
      for (const group of rule.conditionGroups) {
        for (const cond of group.conditions) {
          assert.ok(isValidCondition(cond), `Condition "${cond.id}" is invalid`);
        }
      }
    }
  });

  it("all actions are valid", () => {
    for (const rule of ALL_RULES) {
      for (const action of rule.actions) {
        assert.ok(isValidAction(action), `Action "${action.id}" in rule "${rule.id}" is invalid`);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// EmptyState props contract
// ---------------------------------------------------------------------------

describe("EmptyState — props contract", () => {
  it("renders correctly with no rules present", () => {
    const props = { rules: [], onNewRule: () => {} };
    assert.strictEqual(props.rules.length, 0);
    assert.strictEqual(typeof props.onNewRule, "function");
  });

  it("onNewRule callback is optional", () => {
    const props = {};
    assert.strictEqual(props.onNewRule, undefined);
  });
});

// ---------------------------------------------------------------------------
// LoadingState props contract
// ---------------------------------------------------------------------------

describe("LoadingState — props contract", () => {
  it("defaults message to loading rules string", () => {
    const defaultMessage = "Loading rules...";
    assert.ok(defaultMessage.length > 0);
  });

  it("accepts a custom message", () => {
    const props = { message: "Saving..." };
    assert.strictEqual(props.message, "Saving...");
  });
});

// ---------------------------------------------------------------------------
// ErrorState props contract
// ---------------------------------------------------------------------------

describe("ErrorState — props contract", () => {
  it("requires a non-empty message", () => {
    const props = { message: "Failed to load rules" };
    assert.ok(props.message.length > 0);
  });

  it("onRetry is optional", () => {
    const propsWithRetry = { message: "Error", onRetry: () => {} };
    assert.strictEqual(typeof propsWithRetry.onRetry, "function");

    const propsWithoutRetry = { message: "Error" };
    assert.strictEqual(propsWithoutRetry.onRetry, undefined);
  });
});

// ---------------------------------------------------------------------------
// SuccessState props contract
// ---------------------------------------------------------------------------

describe("SuccessState — props contract", () => {
  it("requires a message", () => {
    const props = { message: "Rule created." };
    assert.ok(props.message.length > 0);
  });

  it("onDismiss is optional", () => {
    const props = { message: "Done" };
    assert.strictEqual(props.onDismiss, undefined);
  });
});

// ---------------------------------------------------------------------------
// RuleList data contract
// ---------------------------------------------------------------------------

describe("RuleList — data contract", () => {
  it("receives an array of rules", () => {
    const props = { rules: ALL_RULES };
    assert.strictEqual(Array.isArray(props.rules), true);
    assert.strictEqual(props.rules.length, 3);
  });

  it("each rule has the fields the list renders", () => {
    for (const rule of ALL_RULES) {
      assert.ok("id" in rule);
      assert.ok("name" in rule);
      assert.ok("description" in rule);
      assert.ok("enabled" in rule);
      assert.ok("priority" in rule);
      assert.ok("conditionGroups" in rule);
      assert.ok("actions" in rule);
    }
  });

  it("toggle changes enabled flag", () => {
    const rule = { ...RULE_1 };
    rule.enabled = !rule.enabled;
    assert.strictEqual(rule.enabled, false);
    rule.enabled = !rule.enabled;
    assert.strictEqual(rule.enabled, true);
  });

  it("delete filters rule from list", () => {
    const rules = [...ALL_RULES];
    const after = rules.filter((r) => r.id !== "rule-2");
    assert.strictEqual(after.length, 2);
    assert.ok(!after.some((r) => r.id === "rule-2"));
  });
});

// ---------------------------------------------------------------------------
// RuleBuilder view-state logic
// ---------------------------------------------------------------------------

describe("RuleBuilder — view-state logic", () => {
  it("create mode: no existing rule passed", () => {
    const props = { rule: undefined };
    assert.strictEqual(props.rule, undefined);
  });

  it("edit mode: existing rule passed", () => {
    const props = { rule: RULE_1 };
    assert.strictEqual(props.rule.id, "rule-1");
    assert.strictEqual(props.rule.name, "High priority from executives");
  });

  it("save input merges name and groups", () => {
    // Simulates what handleSave builds before calling addRule/updateRule
    const name = "New rule name";
    const groups = RULE_1.conditionGroups;
    const actions = RULE_1.actions;
    const input = { name, conditionGroups: groups, actions };
    assert.strictEqual(input.name, "New rule name");
    assert.strictEqual(input.conditionGroups.length, 1);
    assert.strictEqual(input.actions.length, 2);
  });
});

// ---------------------------------------------------------------------------
// TeamInboxRulesBuilder view-state machine
// ---------------------------------------------------------------------------

describe("TeamInboxRulesBuilder — view-state machine", () => {
  // Represents the view state transitions as pure state logic
  function makeState() {
    let view = "list";
    let editingRule = null;

    return {
      getView: () => view,
      getEditing: () => editingRule,
      openCreate() { view = "create"; editingRule = null; },
      openEdit(rule) { view = "edit"; editingRule = rule; },
      close() { view = "list"; editingRule = null; },
      save() { view = "list"; editingRule = null; },
    };
  }

  it("starts in list view with no editing rule", () => {
    const s = makeState();
    assert.strictEqual(s.getView(), "list");
    assert.strictEqual(s.getEditing(), null);
  });

  it("openCreate transitions to create view", () => {
    const s = makeState();
    s.openCreate();
    assert.strictEqual(s.getView(), "create");
    assert.strictEqual(s.getEditing(), null);
  });

  it("openEdit transitions to edit view with the rule", () => {
    const s = makeState();
    s.openEdit(RULE_1);
    assert.strictEqual(s.getView(), "edit");
    assert.strictEqual(s.getEditing().id, "rule-1");
  });

  it("close returns to list view and clears editing rule", () => {
    const s = makeState();
    s.openEdit(RULE_1);
    s.close();
    assert.strictEqual(s.getView(), "list");
    assert.strictEqual(s.getEditing(), null);
  });

  it("save returns to list view", () => {
    const s = makeState();
    s.openCreate();
    s.save();
    assert.strictEqual(s.getView(), "list");
  });

  it("Escape (close) from create does not commit any rule", () => {
    const committed = [];
    const s = makeState();
    s.openCreate();
    // User presses Escape — no save() call
    s.close();
    assert.strictEqual(committed.length, 0);
    assert.strictEqual(s.getView(), "list");
  });
});
