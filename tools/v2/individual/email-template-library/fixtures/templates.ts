export type EmailTemplateCategory = "follow-up" | "intro" | "billing" | "support";

export type EmailTemplate = {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  subject: string;
  body: string;
  tags: string[];
  lastUpdated: string;
};

export const emailTemplateCategoryLabels: Record<EmailTemplateCategory, string> = {
  "follow-up": "Follow-up",
  intro: "Intro",
  billing: "Billing",
  support: "Support",
};

export const emailTemplateFixtures: EmailTemplate[] = [
  {
    id: "follow-up-gentle-nudge",
    name: "Gentle follow-up",
    category: "follow-up",
    subject: "Following up on {{topic}}",
    body: "Hi {{first_name}},\n\nI wanted to follow up on {{topic}} and see if there is anything I can clarify. Happy to adjust the timing if another date works better.\n\nBest,\n{{sender_name}}",
    tags: ["low pressure", "pending reply"],
    lastUpdated: "2026-06-15",
  },
  {
    id: "intro-new-contact",
    name: "New contact intro",
    category: "intro",
    subject: "Introduction from {{sender_name}}",
    body: "Hi {{first_name}},\n\nIt was good connecting with you. I am sharing a short note here so we have a clear thread for {{shared_context}}.\n\nBest,\n{{sender_name}}",
    tags: ["first touch", "relationship"],
    lastUpdated: "2026-06-12",
  },
  {
    id: "billing-payment-reminder",
    name: "Payment reminder",
    category: "billing",
    subject: "Reminder: invoice {{invoice_number}}",
    body: "Hi {{first_name}},\n\nThis is a quick reminder that invoice {{invoice_number}} is due on {{due_date}}. Let me know if you need the payment link sent again.\n\nThanks,\n{{sender_name}}",
    tags: ["invoice", "due date"],
    lastUpdated: "2026-06-10",
  },
  {
    id: "support-resolution",
    name: "Support resolution",
    category: "support",
    subject: "Resolution for {{ticket_topic}}",
    body: "Hi {{first_name}},\n\nWe resolved {{ticket_topic}} and confirmed the account is working as expected. Reply here if you see the issue again.\n\nRegards,\n{{sender_name}}",
    tags: ["ticket", "resolved"],
    lastUpdated: "2026-06-08",
  },
];
