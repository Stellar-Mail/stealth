import type { InboxRule, MailContext } from "../types";

export const mockRules: InboxRule[] = [
  {
    id: "rule-1",
    name: "High priority from executives",
    description: "Flag and notify team when executive sends high-priority mail",
    enabled: true,
    priority: 1,
    conditionGroups: [
      {
        id: "cg-1",
        logic: "and",
        conditions: [
          { id: "c-1", field: "priority", operator: "equals", value: "high" },
          {
            id: "c-2",
            field: "from",
            operator: "contains",
            value: "@company.com",
          },
        ],
      },
    ],
    actions: [
      {
        id: "a-1",
        type: "flag",
        config: { color: "red" },
      },
      {
        id: "a-2",
        type: "notify",
        config: { channel: "slack", message: "Executive high-priority mail" },
      },
    ],
    createdAt: "2026-01-15T10:00:00Z",
    updatedAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "rule-2",
    name: "Invoice auto-file",
    description: "File invoices from vendors into the invoices folder",
    enabled: true,
    priority: 2,
    conditionGroups: [
      {
        id: "cg-2",
        logic: "or",
        conditions: [
          { id: "c-3", field: "subject", operator: "contains", value: "invoice" },
          { id: "c-4", field: "subject", operator: "contains", value: "billing" },
          { id: "c-5", field: "label", operator: "equals", value: "invoice" },
        ],
      },
    ],
    actions: [
      {
        id: "a-3",
        type: "fileToFolder",
        config: { folder: "Invoices" },
      },
    ],
    createdAt: "2026-02-01T14:30:00Z",
    updatedAt: "2026-02-10T09:00:00Z",
  },
  {
    id: "rule-3",
    name: "Spam detection",
    description: "Auto-delete suspected spam mail",
    enabled: false,
    priority: 0,
    conditionGroups: [
      {
        id: "cg-3",
        logic: "or",
        conditions: [
          { id: "c-6", field: "subject", operator: "contains", value: "buy now" },
          { id: "c-7", field: "subject", operator: "contains", value: "free money" },
          { id: "c-8", field: "from", operator: "contains", value: "spam" },
        ],
      },
    ],
    actions: [
      {
        id: "a-4",
        type: "delete",
        config: {},
      },
    ],
    createdAt: "2026-03-01T08:00:00Z",
    updatedAt: "2026-03-01T08:00:00Z",
  },
  {
    id: "rule-4",
    name: "Support ticket auto-reply",
    description: "Auto-reply to support inquiries with acknowledgment",
    enabled: true,
    priority: 3,
    conditionGroups: [
      {
        id: "cg-4",
        logic: "and",
        conditions: [
          {
            id: "c-9",
            field: "subject",
            operator: "contains",
            value: "support",
          },
          {
            id: "c-10",
            field: "from",
            operator: "contains",
            value: "@",
          },
        ],
      },
    ],
    actions: [
      {
        id: "a-5",
        type: "autoReply",
        config: {
          template: "thank-you",
          subject: "Re: {original_subject}",
        },
      },
      {
        id: "a-6",
        type: "addLabel",
        config: { label: "support" },
      },
    ],
    createdAt: "2026-03-15T12:00:00Z",
    updatedAt: "2026-03-15T12:00:00Z",
  },
];

export const mockMailContexts: MailContext[] = [
  {
    from: "ceo@company.com",
    to: ["team@company.com"],
    subject: "Urgent: Q1 Review",
    body: "Please review the Q1 numbers before the board meeting.",
    priority: "high",
    hasAttachments: true,
    receivedAt: "2026-06-18T09:00:00Z",
    labels: [],
    headers: {},
  },
  {
    from: "vendor@supplier.com",
    to: ["accounts@company.com"],
    subject: "Invoice #12345",
    body: "Please find attached the invoice for March services.",
    priority: "normal",
    hasAttachments: true,
    receivedAt: "2026-06-18T10:00:00Z",
    labels: [],
    headers: {},
  },
  {
    from: "spammer@spam.com",
    to: ["user@company.com"],
    subject: "Buy now! Limited offer!",
    body: "Click here to claim your free money!",
    priority: "low",
    hasAttachments: false,
    receivedAt: "2026-06-18T11:00:00Z",
    labels: [],
    headers: {},
  },
];

export function getMockRuleById(id: string): InboxRule | undefined {
  return mockRules.find((r) => r.id === id);
}

export function getMockEnabledRules(): InboxRule[] {
  return mockRules.filter((r) => r.enabled);
}
