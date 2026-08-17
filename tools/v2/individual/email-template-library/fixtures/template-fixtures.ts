import type { EmailTemplate } from "../types";

export const sampleTemplates: EmailTemplate[] = [
  {
    id: "template-follow-up",
    name: "Friendly follow-up",
    categoryId: "follow-up",
    subject: "Following up, {{firstName}}",
    body: "Hello {{firstName}},\n\nI wanted to follow up about {{topic}}.\n\nBest regards",
    variables: [
      { key: "firstName", label: "First name" },
      { key: "topic", label: "Topic" },
    ],
  },
  {
    id: "template-meeting-request",
    name: "Meeting request",
    categoryId: "meetings",
    subject: "Meeting request: {{meetingTopic}}",
    body: "Hi {{recipientName}},\n\nI would like to schedule a meeting to discuss {{meetingTopic}}.\n\nProposed time: {{proposedTime}}\n\nPlease let me know if this works for you.\n\nThanks,\n{{senderName}}",
    variables: [
      { key: "recipientName", label: "Recipient name" },
      { key: "meetingTopic", label: "Meeting topic" },
      { key: "proposedTime", label: "Proposed time" },
      { key: "senderName", label: "Sender name" },
    ],
  },
  {
    id: "template-thank-you",
    name: "Thank you note",
    categoryId: "follow-up",
    subject: "Thank you, {{recipientName}}",
    body: "Dear {{recipientName}},\n\nThank you for {{reason}}. I really appreciate it!\n\nBest,\n{{senderName}}",
    variables: [
      { key: "recipientName", label: "Recipient name" },
      { key: "reason", label: "Reason for thanks" },
      { key: "senderName", label: "Sender name" },
    ],
  },
  {
    id: "template-introduction",
    name: "Introduction email",
    categoryId: "networking",
    subject: "Introduction: {{person1}} meet {{person2}}",
    body: "Hi {{person1}} and {{person2}},\n\nI wanted to introduce you both as I think you'd have great synergy on {{topic}}.\n\n{{person1}}: {{person1Bio}}\n\n{{person2}}: {{person2Bio}}\n\nI'll let you both take it from here!\n\nBest,\n{{introducerName}}",
    variables: [
      { key: "person1", label: "Person 1 name" },
      { key: "person2", label: "Person 2 name" },
      { key: "topic", label: "Introduction topic" },
      { key: "person1Bio", label: "Person 1 bio" },
      { key: "person2Bio", label: "Person 2 bio" },
      { key: "introducerName", label: "Introducer name" },
    ],
  },
  {
    id: "template-no-category",
    name: "Generic template",
    categoryId: null,
    subject: "{{subject}}",
    body: "{{body}}",
    variables: [
      { key: "subject", label: "Subject line" },
      { key: "body", label: "Email body" },
    ],
  },
];

export const categoriesInFixtures = ["follow-up", "meetings", "networking"];
