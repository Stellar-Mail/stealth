import type { EmailToTodoInput } from "../services/emailToTodoCore";

export const directRequestEmail: EmailToTodoInput = {
  id: "email-direct-request",
  subject: "Please review the invoice by Friday",
  sender: "billing@example.com",
  receivedAt: "2026-06-19T09:00:00Z",
  bodyText: "Please review the attached invoice by Friday and let me know if anything is missing.",
  labels: ["inbox"],
};

export const urgentFollowUpEmail: EmailToTodoInput = {
  id: "email-urgent-follow-up",
  subject: "Urgent: follow up with partner",
  sender: "ops@example.com",
  receivedAt: "2026-06-19T10:30:00Z",
  bodyText: "Can you follow up with the partner today? This is blocking the launch checklist.",
  labels: ["important"],
};

export const newsletterEmail: EmailToTodoInput = {
  id: "email-newsletter",
  subject: "Weekly product updates",
  sender: "newsletter@example.com",
  receivedAt: "2026-06-19T11:00:00Z",
  bodyText: "Here are this week's product updates and release notes.",
  labels: ["newsletter"],
};

export const emailToTodoFixtures = {
  directRequestEmail,
  urgentFollowUpEmail,
  newsletterEmail,
};
