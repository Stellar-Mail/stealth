import { describe, it, expect } from "vitest";
import { RuleEngineService } from "../services/rule-engine.service";
import { mockRules, mockMailContexts } from "../fixtures/rules.fixtures";

describe("RuleEngineService", () => {
  const engine = new RuleEngineService();

  describe("evaluate", () => {
    it("should match when conditions are met", () => {
      const rule = mockRules[0]; // High priority from executives
      const mail = mockMailContexts[0]; // ceo@company.com with high priority

      const result = engine.evaluate(rule, mail);

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe(rule.id);
      expect(result.triggeredActions.length).toBe(rule.actions.length);
    });

    it("should not match when conditions are not met", () => {
      const rule = mockRules[0]; // High priority from executives
      const mail = mockMailContexts[1]; // vendor@supplier.com with normal priority

      const result = engine.evaluate(rule, mail);

      expect(result.matched).toBe(false);
      expect(result.triggeredActions.length).toBe(0);
    });
  });

  describe("evaluateAll", () => {
    it("should evaluate all enabled rules and ignore disabled rules", () => {
      const mail = mockMailContexts[2]; // spammer@spam.com (should match disabled spam rule, but it's disabled)

      const results = engine.evaluateAll(mockRules, mail);

      // Spam rule is disabled, so it shouldn't be in the results at all
      const spamRuleResult = results.find((r) => r.ruleId === "rule-3");
      expect(spamRuleResult).toBeUndefined();

      // Should return results for the 3 enabled rules
      expect(results.length).toBe(3);
    });

    it("should correctly identify matches across multiple rules", () => {
      const mail = mockMailContexts[1]; // vendor@supplier.com with 'Invoice' subject

      const results = engine.evaluateAll(mockRules, mail);

      const invoiceRuleResult = results.find((r) => r.ruleId === "rule-2");
      expect(invoiceRuleResult?.matched).toBe(true);

      const execRuleResult = results.find((r) => r.ruleId === "rule-1");
      expect(execRuleResult?.matched).toBe(false);
    });
  });
});
