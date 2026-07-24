import type { InboxRule, MailContext, RuleAction, RuleEvaluationResult } from "./rules";

/**
 * Presentation-independent input accepted by the team inbox rules executor.
 */
export interface TeamInboxRulesExecutionInput {
  /** The message to evaluate. */
  mail: MailContext;
  /** Rules to evaluate. Disabled rules are ignored by the engine. */
  rules: InboxRule[];
}

/** Stable error codes. Consumers should branch on these codes, not messages. */
export type TeamInboxRulesExecutionErrorCode =
  | "INVALID_INPUT"
  | "INVALID_MAIL"
  | "INVALID_RULE"
  | "EXECUTION_FAILED";

export interface TeamInboxRulesTriggeredAction {
  ruleId: string;
  action: RuleAction;
}

export interface TeamInboxRulesExecutionSuccess {
  evaluatedRuleCount: number;
  matchedRuleCount: number;
  results: RuleEvaluationResult[];
  triggeredActions: TeamInboxRulesTriggeredAction[];
}

export interface TeamInboxRulesExecutionError {
  code: TeamInboxRulesExecutionErrorCode;
  message: string;
  /** Dot/bracket path to the invalid field when validation failed. */
  path?: string;
}

/** Discriminated output contract; expected failures are returned, not thrown. */
export type TeamInboxRulesExecutionResult =
  | { ok: true; data: TeamInboxRulesExecutionSuccess }
  | { ok: false; error: TeamInboxRulesExecutionError };

export type ExecuteTeamInboxRules = (
  input: TeamInboxRulesExecutionInput,
) => TeamInboxRulesExecutionResult;
