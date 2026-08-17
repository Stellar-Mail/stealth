// Synthetic fixtures only. No real senders, message ids, or data.

import type { SequenceBuildInput } from "./followUpSequenceBuilder";

export const sampleInputs: Record<string, SequenceBuildInput> = {
  urgentWithDeadline: {
    messageId: "msg-2001",
    subject: "URGENT: Contract approval needed by 2026-08-01",
    body: "Please follow up on this asap. We need the signed contract by 2026-08-01. This is time sensitive and requires immediate attention.",
    senderName: "Alice Executive",
    senderAddress: "alice@corp.example",
    receivedAt: "2026-07-20T09:00:00.000Z",
    timeZone: "America/New_York",
  },
  normalFollowUp: {
    messageId: "msg-2002",
    subject: "Proposal review",
    body: "Let me know your thoughts on the proposal when you get a chance. Would like to circle back on this soon.",
    senderName: "Bob Manager",
    senderAddress: "bob@team.example",
    receivedAt: "2026-07-19T14:00:00.000Z",
    timeZone: "America/New_York",
  },
  lowPriorityFyi: {
    messageId: "msg-2003",
    subject: "FYI: Quarterly report",
    body: "Just sharing the quarterly report. No rush, FYI only. Whenever you get a chance to look at it.",
    senderName: "Carol Analyst",
    senderAddress: "carol@reports.example",
    receivedAt: "2026-07-18T10:00:00.000Z",
  },
  noSignal: {
    messageId: "msg-2004",
    subject: "Lunch this weekend",
    body: "Are you free for lunch this Saturday? Hope to see you there.",
    senderName: "Dave Friend",
    senderAddress: "dave@personal.example",
    receivedAt: "2026-07-17T08:00:00.000Z",
  },
  explicitNoUrgency: {
    messageId: "msg-2005",
    subject: "Follow up on action items",
    body: "Please follow up on the action items from our meeting. Keep me posted on progress.",
    senderAddress: "eve@team.example",
    receivedAt: "2026-07-16T11:00:00.000Z",
  },
  criticalWithDeadline: {
    messageId: "msg-2006",
    subject: "Payment deadline 2026-07-25",
    body: "Urgent: payment is due before 2026-07-25. Please follow up immediately to avoid late fees. This is time-sensitive.",
    senderName: "Frank Finance",
    senderAddress: "frank@billing.example",
    receivedAt: "2026-07-15T16:00:00.000Z",
    timeZone: "America/New_York",
  },
  gentleCheckIn: {
    messageId: "msg-2007",
    subject: "Just checking in",
    body: "Thought I would touch base and see how things are going. No hurry, whenever you have a moment.",
    senderName: "Grace Mentor",
    senderAddress: "grace@mentor.example",
    receivedAt: "2026-07-14T12:00:00.000Z",
  },
};

export const sampleInputList: SequenceBuildInput[] = Object.values(sampleInputs);
