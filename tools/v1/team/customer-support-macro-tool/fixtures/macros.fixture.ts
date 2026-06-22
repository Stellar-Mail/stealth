/**
 * Customer Support Macro Tool — Local Fixture Data
 *
 * Realistic sample macros for development, stories, and tests.
 * Import from anywhere inside this tool folder; do NOT import from src/.
 */

import type { Macro } from "../services/macro.service";

export const FIXTURE_MACROS: Macro[] = [
  {
    id: "macro_fixture_001",
    title: "Welcome greeting",
    body: "Hi {{customer_name}},\n\nThank you for reaching out to {{company_name}} support. I'm {{agent_name}} and I'll be assisting you today.\n\nHow can I help you?",
    category: "greeting",
    tags: ["welcome", "introduction"],
    createdAt: "2025-01-10T09:00:00.000Z",
    updatedAt: "2025-01-10T09:00:00.000Z",
    usageCount: 147,
    isFavorite: true,
  },
  {
    id: "macro_fixture_002",
    title: "Order status — processing",
    body: "Hi {{customer_name}},\n\nYour order #{{order_id}} is currently being processed. Expected dispatch date is {{dispatch_date}}.\n\nYou'll receive a tracking number via email once the order ships.",
    category: "shipping",
    tags: ["order", "status", "processing"],
    createdAt: "2025-01-12T10:30:00.000Z",
    updatedAt: "2025-02-01T14:20:00.000Z",
    usageCount: 89,
    isFavorite: false,
  },
  {
    id: "macro_fixture_003",
    title: "Refund approved",
    body: "Hi {{customer_name}},\n\nGreat news — your refund of {{refund_amount}} for order #{{order_id}} has been approved.\n\nPlease allow 5–10 business days for the amount to appear on your statement.\n\nLet us know if you have any questions.",
    category: "refund",
    tags: ["refund", "approved", "billing"],
    createdAt: "2025-01-15T08:00:00.000Z",
    updatedAt: "2025-01-15T08:00:00.000Z",
    usageCount: 63,
    isFavorite: true,
  },
  {
    id: "macro_fixture_004",
    title: "Password reset instructions",
    body: "Hi {{customer_name}},\n\nTo reset your password:\n1. Go to {{reset_url}}\n2. Enter your email address\n3. Check your inbox for the reset link (valid for 24 hours)\n\nIf you still have trouble, reply to this message and I'll help you further.",
    category: "technical",
    tags: ["password", "reset", "account"],
    createdAt: "2025-01-18T11:00:00.000Z",
    updatedAt: "2025-03-05T16:45:00.000Z",
    usageCount: 212,
    isFavorite: true,
  },
  {
    id: "macro_fixture_005",
    title: "Invoice request",
    body: "Hi {{customer_name}},\n\nI've attached your invoice #{{invoice_number}} for the period {{billing_period}} to this message.\n\nIf you need a different format or have billing questions, don't hesitate to ask.",
    category: "billing",
    tags: ["invoice", "billing"],
    createdAt: "2025-01-20T09:30:00.000Z",
    updatedAt: "2025-01-20T09:30:00.000Z",
    usageCount: 34,
    isFavorite: false,
  },
  {
    id: "macro_fixture_006",
    title: "Issue escalated to engineering",
    body: "Hi {{customer_name}},\n\nThank you for your patience. I've escalated your issue (ref: {{ticket_id}}) to our engineering team for investigation.\n\nOur team will follow up within {{sla_hours}} business hours with an update.",
    category: "technical",
    tags: ["escalation", "engineering", "bug"],
    createdAt: "2025-02-01T10:00:00.000Z",
    updatedAt: "2025-02-10T12:00:00.000Z",
    usageCount: 28,
    isFavorite: false,
  },
  {
    id: "macro_fixture_007",
    title: "Closing message",
    body: "Hi {{customer_name}},\n\nI hope I've been able to help! Please don't hesitate to reach out if you need anything else.\n\nHave a great day!\n{{agent_name}}\n{{company_name}} Support",
    category: "general",
    tags: ["closing", "goodbye"],
    createdAt: "2025-02-05T08:00:00.000Z",
    updatedAt: "2025-02-05T08:00:00.000Z",
    usageCount: 198,
    isFavorite: true,
  },
  {
    id: "macro_fixture_008",
    title: "Subscription cancellation confirmed",
    body: "Hi {{customer_name}},\n\nWe're sorry to see you go. Your subscription to {{plan_name}} has been cancelled effective {{cancellation_date}}.\n\nYou'll retain access until the end of your current billing period on {{billing_end_date}}.\n\nIf you change your mind, you can reactivate at any time from your account settings.",
    category: "billing",
    tags: ["subscription", "cancellation"],
    createdAt: "2025-02-08T09:15:00.000Z",
    updatedAt: "2025-02-08T09:15:00.000Z",
    usageCount: 17,
    isFavorite: false,
  },
];

/** Fixture with no variables — useful for simple tests. */
export const FIXTURE_MACRO_NO_VARS: Macro = {
  id: "macro_fixture_static",
  title: "Static response",
  body: "Thank you for your message. We will respond within 24 hours.",
  category: "general",
  tags: ["static"],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  usageCount: 5,
  isFavorite: false,
};

/** Fixture with multiple variables — for interpolation tests. */
export const FIXTURE_MACRO_WITH_VARS: Macro = {
  id: "macro_fixture_vars",
  title: "Multi-variable response",
  body: "Hi {{customer_name}}, your ticket {{ticket_id}} is assigned to {{agent_name}}.",
  category: "general",
  tags: ["variables"],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  usageCount: 0,
  isFavorite: false,
};
