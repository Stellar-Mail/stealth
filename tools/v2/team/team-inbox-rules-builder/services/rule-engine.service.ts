import type {
  InboxRule,
  MailContext,
  RuleEvaluationResult,
  Condition,
  ConditionGroup,
} from "../types";

export class RuleEngineService {
  evaluate(rule: InboxRule, mailContext: MailContext): RuleEvaluationResult {
    const matchedGroups: string[] = [];

    for (const group of rule.conditionGroups) {
      const groupMatched = this.evaluateConditionGroup(group, mailContext);
      if (groupMatched) {
        matchedGroups.push(group.id);
      }
    }

    const matched = rule.conditionGroups.length > 0 && matchedGroups.length > 0;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      matched,
      matchedConditions: [],
      matchedGroups,
      triggeredActions: matched ? rule.actions : [],
    };
  }

  evaluateAll(rules: InboxRule[], mailContext: MailContext): RuleEvaluationResult[] {
    return rules.filter((r) => r.enabled).map((rule) => this.evaluate(rule, mailContext));
  }

  private evaluateConditionGroup(group: ConditionGroup, mail: MailContext): boolean {
    if (group.logic === "and") {
      return group.conditions.every((c) => this.evaluateCondition(c, mail));
    }
    return group.conditions.some((c) => this.evaluateCondition(c, mail));
  }

  private evaluateCondition(condition: Condition, mail: MailContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, mail);
    if (fieldValue === undefined || fieldValue === null) {
      return condition.operator === "notExists";
    }

    switch (condition.operator) {
      case "equals":
        return String(fieldValue).toLowerCase() === condition.value.toLowerCase();
      case "contains":
        return String(fieldValue).toLowerCase().includes(condition.value.toLowerCase());
      case "startsWith":
        return String(fieldValue).toLowerCase().startsWith(condition.value.toLowerCase());
      case "endsWith":
        return String(fieldValue).toLowerCase().endsWith(condition.value.toLowerCase());
      case "matches":
        try {
          return new RegExp(condition.value, "i").test(String(fieldValue));
        } catch {
          return false;
        }
      case "exists":
        return fieldValue !== undefined && fieldValue !== null && String(fieldValue).length > 0;
      case "notExists":
        return !fieldValue || String(fieldValue).length === 0;
      case "greaterThan":
        return Number(fieldValue) > Number(condition.value);
      case "lessThan":
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  }

  private getFieldValue(field: string, mail: MailContext): unknown {
    switch (field) {
      case "from":
        return mail.from;
      case "to":
        return mail.to.join(", ");
      case "subject":
        return mail.subject;
      case "body":
        return mail.body;
      case "priority":
        return mail.priority;
      case "hasAttachments":
        return mail.hasAttachments ? "true" : "false";
      case "receivedAfter":
      case "receivedBefore":
        return mail.receivedAt;
      case "label":
        return mail.labels.join(", ");
      case "customHeader":
        return "";
      default:
        return undefined;
    }
  }
}
