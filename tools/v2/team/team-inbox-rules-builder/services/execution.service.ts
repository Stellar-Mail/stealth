import {
  MAX_CONDITION_GROUPS,
  MAX_CONDITIONS_PER_GROUP,
  MAX_MAIL_BODY_LENGTH,
  MAX_MAIL_SUBJECT_LENGTH,
  MAX_RULES,
  sanitizeText,
} from "./guards";

import type {
  InboxRule,
  MailContext,
  RuleEvaluationResult,
  TeamInboxRulesExecutionErrorCode,
  TeamInboxRulesExecutionInput,
  TeamInboxRulesExecutionResult,
} from "../types";
import { RuleEngineService } from "./rule-engine.service";

/** Minimal service boundary required by the non-UI executor. */
export interface TeamInboxRulesEvaluator {
  evaluateAll(rules: InboxRule[], mail: MailContext): RuleEvaluationResult[];
}

export interface TeamInboxRulesExecutorDependencies {
  evaluator: TeamInboxRulesEvaluator;
}

function failure(
  code: TeamInboxRulesExecutionErrorCode,
  message: string,
  path?: string,
): TeamInboxRulesExecutionResult {
  return { ok: false, error: { code, message, ...(path ? { path } : {}) } };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateMail(mail: MailContext | undefined): TeamInboxRulesExecutionResult | null {
  if (!mail || typeof mail !== "object") {
    return failure("INVALID_MAIL", "mail must be an object", "mail");
  }

  if (!isNonEmptyString(mail.from)) {
    return failure("INVALID_MAIL", "mail.from is required", "mail.from");
  }

  if (!Array.isArray(mail.to)) {
    return failure("INVALID_MAIL", "mail.to must be an array", "mail.to");
  }

  if (typeof mail.subject !== "string") {
    return failure("INVALID_MAIL", "mail.subject must be a string", "mail.subject");
  }

  if (typeof mail.body !== "string") {
    return failure("INVALID_MAIL", "mail.body must be a string", "mail.body");
  }

  const subject = sanitizeText(mail.subject);
  const body = sanitizeText(mail.body);

  if (subject.length > MAX_MAIL_SUBJECT_LENGTH) {
    return failure(
      "INVALID_MAIL",
      "mail.subject exceeds the maximum allowed length",
      "mail.subject",
    );
  }

  if (body.length > MAX_MAIL_BODY_LENGTH) {
    return failure("INVALID_MAIL", "mail.body exceeds the maximum allowed length", "mail.body");
  }

  if (!["low", "normal", "high"].includes(mail.priority)) {
    return failure("INVALID_MAIL", "mail.priority is invalid", "mail.priority");
  }

  if (typeof mail.hasAttachments !== "boolean") {
    return failure("INVALID_MAIL", "mail.hasAttachments must be a boolean", "mail.hasAttachments");
  }

  if (!isNonEmptyString(mail.receivedAt) || Number.isNaN(Date.parse(mail.receivedAt))) {
    return failure("INVALID_MAIL", "mail.receivedAt must be an ISO date", "mail.receivedAt");
  }

  if (!Array.isArray(mail.labels)) {
    return failure("INVALID_MAIL", "mail.labels must be an array", "mail.labels");
  }

  if (!mail.headers || typeof mail.headers !== "object" || Array.isArray(mail.headers)) {
    return failure("INVALID_MAIL", "mail.headers must be an object", "mail.headers");
  }

  return null;
}

function validateRules(rules: InboxRule[] | undefined): TeamInboxRulesExecutionResult | null {
  if (!Array.isArray(rules)) {
    return failure("INVALID_INPUT", "rules must be an array", "rules");
  }

  if (rules.length > MAX_RULES) {
    return failure("INVALID_INPUT", `rules cannot exceed ${MAX_RULES} entries`, "rules");
  }

  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const root = `rules[${index}]`;

    if (!rule || typeof rule !== "object") {
      return failure("INVALID_RULE", "rule must be an object", root);
    }

    if (!isNonEmptyString(rule.id)) {
      return failure("INVALID_RULE", "rule.id is required", `${root}.id`);
    }

    if (!isNonEmptyString(rule.name)) {
      return failure("INVALID_RULE", "rule.name is required", `${root}.name`);
    }

    if (typeof rule.enabled !== "boolean") {
      return failure("INVALID_RULE", "rule.enabled must be a boolean", `${root}.enabled`);
    }

    if (!Array.isArray(rule.conditionGroups) || rule.conditionGroups.length === 0) {
      return failure(
        "INVALID_RULE",
        "rule.conditionGroups must contain at least one group",
        `${root}.conditionGroups`,
      );
    }

    if (rule.conditionGroups.length > MAX_CONDITION_GROUPS) {
      return failure(
        "INVALID_RULE",
        `rule cannot contain more than ${MAX_CONDITION_GROUPS} condition groups`,
        `${root}.conditionGroups`,
      );
    }

    for (const [groupIndex, group] of rule.conditionGroups.entries()) {
      if (!Array.isArray(group.conditions)) {
        return failure(
          "INVALID_RULE",
          "condition group must contain a conditions array",
          `${root}.conditionGroups[${groupIndex}].conditions`,
        );
      }

      if (group.conditions.length > MAX_CONDITIONS_PER_GROUP) {
        return failure(
          "INVALID_RULE",
          `condition group cannot contain more than ${MAX_CONDITIONS_PER_GROUP} conditions`,
          `${root}.conditionGroups[${groupIndex}].conditions`,
        );
      }
    }

    if (!Array.isArray(rule.actions) || rule.actions.length === 0) {
      return failure(
        "INVALID_RULE",
        "rule.actions must contain at least one action",
        `${root}.actions`,
      );
    }
  }

  return null;
}

/**
 * Creates a presentation-independent executor. Dependency injection keeps the
 * orchestration boundary usable with a real engine, fake, or backend adapter.
 */
export function createTeamInboxRulesExecutor({ evaluator }: TeamInboxRulesExecutorDependencies) {
  return {
    execute(input: TeamInboxRulesExecutionInput): TeamInboxRulesExecutionResult {
      if (!input || typeof input !== "object") {
        return failure("INVALID_INPUT", "input must be an object");
      }

      const mailFailure = validateMail(input.mail);
      if (mailFailure) {
        return mailFailure;
      }

      const rulesFailure = validateRules(input.rules);
      if (rulesFailure) {
        return rulesFailure;
      }

      try {
        const results = evaluator.evaluateAll(input.rules, input.mail);
        const matches = results.filter((result) => result.matched);

        return {
          ok: true,
          data: {
            evaluatedRuleCount: results.length,
            matchedRuleCount: matches.length,
            results,
            triggeredActions: matches.flatMap((result) =>
              result.triggeredActions.map((action) => ({
                ruleId: result.ruleId,
                action,
              })),
            ),
          },
        };
      } catch (error) {
        return failure(
          "EXECUTION_FAILED",
          error instanceof Error ? error.message : "Rule evaluation failed",
        );
      }
    },
  };
}

export type TeamInboxRulesExecutor = ReturnType<typeof createTeamInboxRulesExecutor>;

/** Default backend-facing entry point using the tool's rule engine. */
export const teamInboxRulesExecutor = createTeamInboxRulesExecutor({
  evaluator: new RuleEngineService(),
});
