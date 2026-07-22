import type { DraftInput } from "../types";

export const sampleDrafts: DraftInput[] = [
  {
    id: "draft-renewal-001",
    subject: "Renewal deadline due 2026-06-20",
    body: "Dear Team,\n\nI am writing to remind you that our service renewal is due by 2026-06-20 at 17:00. Please submit the recieved payment confirmation before the deadline to avoid any interruption.\n\nBest regards,\nJohn",
    recipientName: "Team",
    senderName: "John",
    containsPersonalData: false,
  },
  {
    id: "draft-ambiguous-002",
    subject: "Can you handle this soon?",
    body: "We should probably finish the response next week, but no exact commitment was provided.\n\nLet me know what you think.\n\n-Jane",
    recipientName: "Team Lead",
    senderName: "Jane",
    containsPersonalData: false,
  },
  {
    id: "draft-overdue-003",
    subject: "",
    body: "Hey Bob, I noticed the conference registration was definately due last week. Did we miss it? I will check with the coordinator.\n\nThanks,\nSam",
    recipientName: "Bob",
    senderName: "Sam",
    containsPersonalData: false,
  },
  {
    id: "draft-sensitive-004",
    subject: "API access update",
    body: "Hi team,\n\nI have updated the api_key for our staging environment. The new secret is included below:\n\nEXAMPLE_placeholder_value\n\nPlease update your .env file.\n\nBest,\nAlex",
    recipientName: "Team",
    senderName: "Alex",
    containsPersonalData: false,
  },
  {
    id: "draft-good-005",
    subject: "Q3 project update review",
    body: "Hi Maria,\n\nCould you please review the attached Q3 project update by Friday? I would appreciate your feedback on the budget section.\n\nLet me know if you have any questions.\n\nBest regards,\nChris",
    recipientName: "Maria",
    senderName: "Chris",
    containsPersonalData: false,
  },
];
