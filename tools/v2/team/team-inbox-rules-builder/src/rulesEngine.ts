export type RuleCondition = {
  fromContains?: string;
  subjectIncludes?: string;
  tagsInclude?: string[];
  projectEquals?: string;
};

export type RuleAction =
  | { type: "label"; label: string }
  | { type: "move"; destination: string }
  | { type: "assign"; assignee: string }
  | { type: "flag"; severity: "low" | "medium" | "high" };

export type TeamInboxRule = {
  id: string;
  name: string;
  enabled: boolean;
  conditions: RuleCondition;
  actions: RuleAction[];
};

export type MessageContext = {
  from: string;
  subject: string;
  tags?: string[];
  project?: string;
  body?: string;
};

export type RuleMatchResult = {
  rule: TeamInboxRule;
  actions: RuleAction[];
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function stringIncludes(value: string | undefined, candidate: string): boolean {
  if (!value) return false;
  return normalize(value).includes(normalize(candidate));
}

function tagsMatch(messageTags: string[] | undefined, expected: string[]): boolean {
  if (!messageTags || messageTags.length === 0) return false;
  const normalizedTags = messageTags.map(normalize);
  return expected.every((tag) => normalizedTags.includes(normalize(tag)));
}

export function matchesRule(message: MessageContext, rule: TeamInboxRule): boolean {
  if (!rule.enabled) return false;

  const { conditions } = rule;
  if (conditions.fromContains && !stringIncludes(message.from, conditions.fromContains)) {
    return false;
  }

  if (conditions.subjectIncludes && !stringIncludes(message.subject, conditions.subjectIncludes)) {
    return false;
  }

  if (conditions.tagsInclude && !tagsMatch(message.tags, conditions.tagsInclude)) {
    return false;
  }

  if (
    conditions.projectEquals &&
    normalize(message.project ?? "") !== normalize(conditions.projectEquals)
  ) {
    return false;
  }

  return true;
}

export function evaluateInboxRules(
  message: MessageContext,
  rules: TeamInboxRule[],
): RuleMatchResult[] {
  return rules
    .filter((rule) => matchesRule(message, rule))
    .map((rule) => ({ rule, actions: rule.actions }));
}
