import { describe, it, expect, beforeEach } from "vitest";
import { RuleStorageService, RuleEngineService, ValidationService } from "../services";
import {
  MAX_RULE_NAME_LENGTH,
  MAX_RULE_DESCRIPTION_LENGTH,
  MAX_EMAIL_BODY_PROCESSING_LENGTH,
} from "../services/validation.service";
import type { MailContext, CreateRuleInput } from "../types";

describe("Hardening Tests", () => {
  let storageService: RuleStorageService;
  let engineService: RuleEngineService;

  beforeEach(() => {
    storageService = new RuleStorageService();
    engineService = new RuleEngineService();
  });

  describe("Security Hardening", () => {
    it("should reject rule name longer than MAX_RULE_NAME_LENGTH", async () => {
      const longName = "A".repeat(MAX_RULE_NAME_LENGTH + 10);
      const input: CreateRuleInput = {
        name: longName,
        conditionGroups: [],
        actions: [],
      };

      await expect(storageService.addRule(input)).rejects.toThrow();
    });

    it("should reject rule description longer than MAX_RULE_DESCRIPTION_LENGTH", async () => {
      const longDescription = "D".repeat(MAX_RULE_DESCRIPTION_LENGTH + 10);
      const input: CreateRuleInput = {
        name: "Test Rule",
        description: longDescription,
        conditionGroups: [],
        actions: [],
      };

      await expect(storageService.addRule(input)).rejects.toThrow();
    });

    it("should handle invalid regex gracefully", async () => {
      const rule = await storageService.addRule({
        name: "Invalid Regex Rule",
        conditionGroups: [
          {
            id: "cg-1",
            logic: "and",
            conditions: [
              {
                id: "c-1",
                field: "subject",
                operator: "matches",
                value: "[unclosed bracket",
              },
            ],
          },
        ],
        actions: [],
      });

      const mail: MailContext = {
        from: "test@test.com",
        to: ["to@test.com"],
        subject: "Anything",
        body: "Body",
        priority: "normal",
        hasAttachments: false,
        receivedAt: new Date().toISOString(),
        labels: [],
        headers: {},
      };

      const result = engineService.evaluate(rule, mail);
      expect(result.matched).toBe(false);
    });

    it("should throw error when input is malformed (Zod validation)", async () => {
      const malformedInput = {
        name: "", // Too short
        conditionGroups: "not an array",
      };

      await expect(storageService.addRule(malformedInput as any)).rejects.toThrow();
    });
  });

  describe("Performance Hardening", () => {
    it("should truncate large email body during evaluation", async () => {
      const hugeBody = "B".repeat(MAX_EMAIL_BODY_PROCESSING_LENGTH + 1000);

      const rule = await storageService.addRule({
        name: "Large Body Rule",
        conditionGroups: [
          {
            id: "cg-1",
            logic: "and",
            conditions: [
              {
                id: "c-1",
                field: "body",
                operator: "contains",
                value: "BBBBB",
              },
            ],
          },
        ],
        actions: [],
      });

      const mail: MailContext = {
        from: "test@test.com",
        to: ["to@test.com"],
        subject: "Subject",
        body: hugeBody,
        priority: "normal",
        hasAttachments: false,
        receivedAt: new Date().toISOString(),
        labels: [],
        headers: {},
      };

      // The evaluation should still work, but it should be using the truncated content.
      // We can't directly observe truncation inside evaluate, but we can test that it doesn't crash
      // and behaves correctly for matches within the truncated range.
      const result = engineService.evaluate(rule, mail);
      expect(result.matched).toBe(true);
    });

    it("should not match if the value is only present in the truncated part of the body", async () => {
      const body = "A".repeat(MAX_EMAIL_BODY_PROCESSING_LENGTH) + "TARGET";

      const rule = await storageService.addRule({
        name: "Truncation Test Rule",
        conditionGroups: [
          {
            id: "cg-1",
            logic: "and",
            conditions: [
              {
                id: "c-1",
                field: "body",
                operator: "contains",
                value: "TARGET",
              },
            ],
          },
        ],
        actions: [],
      });

      const mail: MailContext = {
        from: "test@test.com",
        to: ["to@test.com"],
        subject: "Subject",
        body: body,
        priority: "normal",
        hasAttachments: false,
        receivedAt: new Date().toISOString(),
        labels: [],
        headers: {},
      };

      const result = engineService.evaluate(rule, mail);
      expect(result.matched).toBe(false); // Should be false because "TARGET" was truncated
    });
  });
});
