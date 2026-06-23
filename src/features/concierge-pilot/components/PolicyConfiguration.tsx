/**
 * Concierge Pilot Policy Configuration Component
 * 
 * UI for configuring allow, request, block, and paid-access rules.
 * Supports adding, editing, and removing policy rules.
 */

import { useState } from "react";
import type { PolicyRule, PilotPolicyCategory } from "../types";

interface PolicyConfigurationProps {
  userId: string;
  rules: PolicyRule[];
  defaultCategory: PilotPolicyCategory;
  onAddRule: (senderIdentifier: string, category: PilotPolicyCategory) => void;
  onUpdateRule: (ruleId: string, category: PilotPolicyCategory) => void;
  onDeleteRule: (ruleId: string) => void;
}

const CATEGORY_DESCRIPTIONS: Record<PilotPolicyCategory, string> = {
  allow: "Trusted sender - reaches inbox immediately",
  request: "Unknown sender - requires your approval to deliver",
  block: "Blocked sender - no notification, no delivery",
  "paid-access": "Paid sender - must attach postage to reach inbox",
};

const CATEGORY_COLORS: Record<PilotPolicyCategory, string> = {
  allow: "bg-green-100 text-green-800",
  request: "bg-blue-100 text-blue-800",
  block: "bg-red-100 text-red-800",
  "paid-access": "bg-yellow-100 text-yellow-800",
};

export function PolicyConfiguration({
  userId,
  rules,
  defaultCategory,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
}: PolicyConfigurationProps) {
  const [newSender, setNewSender] = useState("");
  const [newCategory, setNewCategory] = useState<PilotPolicyCategory>("request");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] =
    useState<PilotPolicyCategory>("request");

  const handleAddRule = () => {
    if (!newSender.trim()) return;
    onAddRule(newSender, newCategory);
    setNewSender("");
    setNewCategory("request");
  };

  const handleEditRule = (ruleId: string, currentCategory: PilotPolicyCategory) => {
    setEditingRuleId(ruleId);
    setEditingCategory(currentCategory);
  };

  const handleSaveEdit = (ruleId: string) => {
    onUpdateRule(ruleId, editingCategory);
    setEditingRuleId(null);
  };

  const categories: PilotPolicyCategory[] = ["allow", "request", "block", "paid-access"];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Policy Configuration</h2>
        <p className="text-sm text-gray-600">
          Default policy: <span className="font-medium">{defaultCategory}</span>
        </p>
      </div>

      {/* Add New Rule */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-medium">Add New Policy Rule</h3>
        <div className="space-y-2">
          <div>
            <label className="text-sm font-medium">Sender Identifier</label>
            <input
              type="text"
              placeholder="e.g., alice@stealth.email or alice*"
              value={newSender}
              onChange={(e) => setNewSender(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use * as wildcard, e.g., alice* matches alice@domain.com
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Policy Category</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as PilotPolicyCategory)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} - {CATEGORY_DESCRIPTIONS[cat]}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleAddRule}
            disabled={!newSender.trim()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Add Rule
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-2">
        <h3 className="font-medium">Current Rules ({rules.length})</h3>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            No custom rules yet. All senders will use the default policy.
          </p>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-3 border rounded-md"
              >
                <div className="flex-1">
                  <div className="font-mono text-sm">{rule.senderIdentifier}</div>
                  <div className="text-xs text-gray-500">
                    Created {new Date(rule.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {editingRuleId === rule.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editingCategory}
                      onChange={(e) =>
                        setEditingCategory(e.target.value as PilotPolicyCategory)
                      }
                      className="px-2 py-1 border rounded text-sm"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleSaveEdit(rule.id)}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingRuleId(null)}
                      className="px-2 py-1 text-xs bg-gray-300 rounded hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        CATEGORY_COLORS[rule.category]
                      }`}
                    >
                      {rule.category}
                    </span>
                    <button
                      onClick={() => handleEditRule(rule.id, rule.category)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
        <h4 className="font-medium text-blue-900 mb-2">Policy Categories</h4>
        <ul className="space-y-1 text-blue-800">
          {categories.map((cat) => (
            <li key={cat}>
              <span className="font-medium">{cat}:</span> {CATEGORY_DESCRIPTIONS[cat]}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
