// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createTeamInboxRulesExecutor,
  teamInboxRulesExecutor,
} from "../services/execution.service";
import {
  failingEvaluator,
  invalidMailExecutionInput,
  invalidRuleExecutionInput,
  successfulExecutionInput,
} from "../fixtures/execution.fixtures";

describe("teamInboxRulesExecutor", () => {
  it("executes rules without UI dependencies and returns triggered actions", () => {
    const result = teamInboxRulesExecutor.execute(successfulExecutionInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.evaluatedRuleCount).toBe(3);
    expect(result.data.matchedRuleCount).toBe(1);
    expect(result.data.triggeredActions).toEqual([
      { ruleId: "rule-1", action: successfulExecutionInput.rules[0].actions[0] },
      { ruleId: "rule-1", action: successfulExecutionInput.rules[0].actions[1] },
    ]);
  });

  it("returns INVALID_MAIL for invalid mail input", () => {
    const result = teamInboxRulesExecutor.execute(invalidMailExecutionInput);

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_MAIL", message: "mail.from is required", path: "mail.from" },
    });
  });

  it("returns INVALID_RULE for an invalid rule", () => {
    const result = teamInboxRulesExecutor.execute(invalidRuleExecutionInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_RULE");
    expect(result.error.path).toBe("rules[0].actions");
  });

  it("maps evaluator failures to the stable EXECUTION_FAILED code", () => {
    const executor = createTeamInboxRulesExecutor({ evaluator: failingEvaluator });
    const result = executor.execute(successfulExecutionInput);

    expect(result).toEqual({
      ok: false,
      error: { code: "EXECUTION_FAILED", message: "Rules engine unavailable" },
    });
  });
});
