import { z } from "zod";
import type {
  Condition,
  ConditionGroup,
  RuleAction,
  InboxRule,
  CreateRuleInput,
  UpdateRuleInput,
} from "../types";

// Constants for hardening
export const MAX_RULE_NAME_LENGTH = 100;
export const MAX_RULE_DESCRIPTION_LENGTH = 500;
export const MAX_CONDITION_VALUE_LENGTH = 1000;
export const MAX_ACTION_CONFIG_VALUE_LENGTH = 500;
export const MAX_CONDITIONS_PER_GROUP = 20;
export const MAX_GROUPS_PER_RULE = 10;
export const MAX_ACTIONS_PER_RULE = 10;
export const MAX_EMAIL_BODY_PROCESSING_LENGTH = 100 * 1024; // 100KB

export const ConditionSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  field: z.enum([
    "from",
    "to",
    "subject",
    "body",
    "priority",
    "hasAttachments",
    "receivedAfter",
    "receivedBefore",
    "label",
    "customHeader",
  ]),
  operator: z.enum([
    "equals",
    "contains",
    "startsWith",
    "endsWith",
    "matches",
    "greaterThan",
    "lessThan",
    "exists",
    "notExists",
  ]),
  value: z.string().max(MAX_CONDITION_VALUE_LENGTH),
});

export const ConditionGroupSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  logic: z.enum(["and", "or"]),
  conditions: z.array(ConditionSchema).max(MAX_CONDITIONS_PER_GROUP),
});

export const RuleActionSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  type: z.enum([
    "fileToFolder",
    "forwardTo",
    "markAs",
    "flag",
    "notify",
    "autoReply",
    "addLabel",
    "delete",
  ]),
  config: z.record(z.string().max(100), z.string().max(MAX_ACTION_CONFIG_VALUE_LENGTH)),
});

export const InboxRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(MAX_RULE_NAME_LENGTH),
  description: z.string().max(MAX_RULE_DESCRIPTION_LENGTH),
  enabled: z.boolean(),
  priority: z.number().int(),
  conditionGroups: z.array(ConditionGroupSchema).max(MAX_GROUPS_PER_RULE),
  actions: z.array(RuleActionSchema).max(MAX_ACTIONS_PER_RULE),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateRuleInputSchema = z.object({
  name: z.string().min(1).max(MAX_RULE_NAME_LENGTH),
  description: z.string().max(MAX_RULE_DESCRIPTION_LENGTH).optional(),
  priority: z.number().int().optional(),
  conditionGroups: z.array(ConditionGroupSchema).max(MAX_GROUPS_PER_RULE),
  actions: z.array(RuleActionSchema).max(MAX_ACTIONS_PER_RULE),
});

export const UpdateRuleInputSchema = CreateRuleInputSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export class ValidationService {
  static validateCreateRule(input: unknown): CreateRuleInput {
    return CreateRuleInputSchema.parse(input) as CreateRuleInput;
  }

  static validateUpdateRule(input: unknown): UpdateRuleInput {
    return UpdateRuleInputSchema.parse(input) as UpdateRuleInput;
  }

  static validateRule(rule: unknown): InboxRule {
    return InboxRuleSchema.parse(rule) as InboxRule;
  }

  static isValidRegex(pattern: string): boolean {
    try {
      new RegExp(pattern);
      // Basic check against common ReDoS patterns if needed,
      // but for now, we just check if it's a valid RegExp.
      return true;
    } catch {
      return false;
    }
  }

  static sanitizeString(str: string, maxLength: number): string {
    return str.trim().slice(0, maxLength);
  }

  static truncateEmailContent(content: string): string {
    if (content.length <= MAX_EMAIL_BODY_PROCESSING_LENGTH) {
      return content;
    }
    return content.slice(0, MAX_EMAIL_BODY_PROCESSING_LENGTH);
  }
}
