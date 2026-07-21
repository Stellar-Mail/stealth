import type { TeamInboxRulesExecutionInput, TeamInboxRulesEvaluator } from "../index";
import { mockMailContexts, mockRules } from "./rules.fixtures";

/** Success: the executive/high-priority rule matches this mail. */
export const successfulExecutionInput: TeamInboxRulesExecutionInput = {
  mail: mockMailContexts[0],
  rules: mockRules,
};

/** Failure: mail.from is required by the execution contract. */
export const invalidMailExecutionInput: TeamInboxRulesExecutionInput = {
  mail: { ...mockMailContexts[0], from: "" },
  rules: mockRules,
};

/** Failure: executable rules require at least one action. */
export const invalidRuleExecutionInput: TeamInboxRulesExecutionInput = {
  mail: mockMailContexts[0],
  rules: [{ ...mockRules[0], actions: [] }],
};

/** Failure: injected evaluator simulates an unavailable backend dependency. */
export const failingEvaluator: TeamInboxRulesEvaluator = {
  evaluateAll() {
    throw new Error("Rules engine unavailable");
  },
};
