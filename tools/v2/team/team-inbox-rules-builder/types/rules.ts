export type RuleId = string;
export type ConditionId = string;
export type ConditionGroupId = string;
export type ActionId = string;

export type ConditionField =
  | "from"
  | "to"
  | "subject"
  | "body"
  | "priority"
  | "hasAttachments"
  | "receivedAfter"
  | "receivedBefore"
  | "label"
  | "customHeader";

export type ConditionOperator =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "greaterThan"
  | "lessThan"
  | "exists"
  | "notExists";

export type GroupLogic = "and" | "or";

export interface Condition {
  id: ConditionId;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionGroup {
  id: ConditionGroupId;
  logic: GroupLogic;
  conditions: Condition[];
}

export type RuleActionType =
  "fileToFolder" | "forwardTo" | "markAs" | "flag" | "notify" | "autoReply" | "addLabel" | "delete";

export interface RuleAction {
  id: ActionId;
  type: RuleActionType;
  config: Record<string, string>;
}

export type RuleStatus = "active" | "inactive";

export interface InboxRule {
  id: RuleId;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditionGroups: ConditionGroup[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
}

export type CreateRuleInput = {
  name: string;
  description?: string;
  priority?: number;
  conditionGroups: ConditionGroup[];
  actions: RuleAction[];
};

export type UpdateRuleInput = {
  name?: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  conditionGroups?: ConditionGroup[];
  actions?: RuleAction[];
};

export interface MailContext {
  from: string;
  to: string[];
  subject: string;
  body: string;
  priority: "low" | "normal" | "high";
  hasAttachments: boolean;
  receivedAt: string;
  labels: string[];
  headers: Record<string, string>;
}

export interface RuleEvaluationResult {
  ruleId: RuleId;
  ruleName: string;
  matched: boolean;
  matchedConditions: string[];
  matchedGroups: ConditionGroupId[];
  triggeredActions: RuleAction[];
}

export interface ServiceConfig {
  delayMs: number;
}
