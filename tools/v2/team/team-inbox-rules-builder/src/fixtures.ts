import type { MessageContext, TeamInboxRule } from "./rulesEngine";

export const inboxRules: TeamInboxRule[] = [
  {
    id: "rule-1",
    name: "Prioritize support requests",
    enabled: true,
    conditions: {
      subjectIncludes: "support",
      tagsInclude: ["urgent"],
    },
    actions: [
      { type: "label", label: "Support" },
      { type: "flag", severity: "high" },
    ],
  },
  {
    id: "rule-2",
    name: "Move roadmap updates",
    enabled: true,
    conditions: {
      projectEquals: "Roadmap",
    },
    actions: [{ type: "move", destination: "Roadmap" }],
  },
  {
    id: "rule-3",
    name: "Assign product questions",
    enabled: false,
    conditions: {
      fromContains: "@product.team",
    },
    actions: [{ type: "assign", assignee: "Product Lead" }],
  },
];

export const sampleMessage: MessageContext = {
  from: "customer@example.com",
  subject: "Support needed for urgent login issue",
  tags: ["urgent", "support"],
  project: "Support",
  body: "User cannot access account after password reset.",
};
