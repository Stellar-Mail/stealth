import { describe, expect, it } from "vitest";
import {
  evaluateInboxRules,
  matchesRule,
  type MessageContext,
  type TeamInboxRule,
} from "./rulesEngine";

const rules: TeamInboxRule[] = [
  {
    id: "rule-1",
    name: "Label support",
    enabled: true,
    conditions: { subjectIncludes: "support" },
    actions: [{ type: "label", label: "Support" }],
  },
  {
    id: "rule-2",
    name: "Route roadmap",
    enabled: true,
    conditions: { projectEquals: "Roadmap" },
    actions: [{ type: "move", destination: "Roadmap" }],
  },
  {
    id: "rule-3",
    name: "Disabled rule",
    enabled: false,
    conditions: { subjectIncludes: "urgent" },
    actions: [{ type: "flag", severity: "high" }],
  },
];

const message: MessageContext = {
  from: "alex@example.com",
  subject: "Support ticket review",
  tags: ["support", "urgent"],
  project: "Roadmap",
  body: "Please follow up on the support ticket.",
};

describe("matchesRule", () => {
  it("matches when subject includes the keyword", () => {
    expect(matchesRule(message, rules[0])).toBe(true);
  });

  it("does not match disabled rules", () => {
    expect(matchesRule(message, rules[2])).toBe(false);
  });

  it("requires exact project equality when configured", () => {
    expect(matchesRule(message, rules[1])).toBe(true);
    expect(matchesRule({ ...message, project: "Support" }, rules[1])).toBe(false);
  });
});

describe("evaluateInboxRules", () => {
  it("returns all matching rules and their actions", () => {
    const matches = evaluateInboxRules(message, rules);
    expect(matches).toHaveLength(2);
    expect(matches.map((match) => match.rule.id)).toEqual(["rule-1", "rule-2"]);
    expect(matches.flatMap((match) => match.actions)).toEqual([
      { type: "label", label: "Support" },
      { type: "move", destination: "Roadmap" },
    ]);
  });

  it("returns an empty array when no rules match", () => {
    const noMatchMessage: MessageContext = {
      from: "marketing@example.com",
      subject: "Design update",
      tags: ["design"],
      project: "Marketing",
      body: "Share the design mockups.",
    };

    expect(evaluateInboxRules(noMatchMessage, rules)).toEqual([]);
  });
});
