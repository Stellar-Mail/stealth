// @vitest-environment node
import {
  MAX_CONDITION_GROUPS,
  MAX_CONDITIONS_PER_GROUP,
  MAX_MAIL_BODY_LENGTH,
  MAX_MAIL_SUBJECT_LENGTH,
  MAX_RULES,
} from "../services/guards";
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
describe("security hardening", () => {
  it("rejects oversized mail subjects", () => {
    const input = structuredClone(successfulExecutionInput);

    input.mail.subject = "A".repeat(MAX_MAIL_SUBJECT_LENGTH + 1);

    const result = teamInboxRulesExecutor.execute(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_MAIL");
    expect(result.error.path).toBe("mail.subject");
  });

  it("rejects oversized mail bodies", () => {
    const input = structuredClone(successfulExecutionInput);

    input.mail.body = "A".repeat(MAX_MAIL_BODY_LENGTH + 1);

    const result = teamInboxRulesExecutor.execute(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_MAIL");
    expect(result.error.path).toBe("mail.body");
  });

  it("rejects too many rules", () => {
    const input = structuredClone(successfulExecutionInput);

    input.rules = Array.from({ length: MAX_RULES + 1 }, (_, index) => ({
      ...structuredClone(successfulExecutionInput.rules[0]),
      id: `rule-${index}`,
      name: `Rule ${index}`,
    }));

    const result = teamInboxRulesExecutor.execute(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.path).toBe("rules");
  });

  it("rejects too many condition groups", () => {
    const input = structuredClone(successfulExecutionInput);

    input.rules[0].conditionGroups = Array.from(
      { length: MAX_CONDITION_GROUPS + 1 },
      (_, index) => ({
        ...structuredClone(successfulExecutionInput.rules[0].conditionGroups[0]),
        id: `group-${index}`,
      }),
    );

    const result = teamInboxRulesExecutor.execute(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_RULE");
    expect(result.error.path).toBe("rules[0].conditionGroups");
  });

  it("rejects condition groups with too many conditions", () => {
    const input = structuredClone(successfulExecutionInput);

    input.rules[0].conditionGroups[0].conditions = Array.from(
      { length: MAX_CONDITIONS_PER_GROUP + 1 },
      (_, index) => ({
        ...structuredClone(successfulExecutionInput.rules[0].conditionGroups[0].conditions[0]),
        id: `condition-${index}`,
      }),
    );

    const result = teamInboxRulesExecutor.execute(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_RULE");
    expect(result.error.path).toBe("rules[0].conditionGroups[0].conditions");
  });
});
