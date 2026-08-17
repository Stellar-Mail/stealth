import type { NormalizedEmailInput } from "./followUpReminder";

// Synthetic fixtures only. No real senders, message ids, or data.
export const sampleEmails: Record<string, NormalizedEmailInput> = {
  explicitWithDate: {
    messageId: "msg-1001",
    subject: "Reply by 2026-02-10 about the contract",
    body: "Please follow up and reply by 2026-02-10 with the signed contract.",
    senderName: "Dana Vendor",
    senderAddress: "dana@vendor.example",
    receivedAt: "2026-02-01T09:00:00.000Z",
    timeZone: "America/New_York",
  },
  relativeNextWeek: {
    messageId: "msg-1002",
    subject: "Check back next week",
    body: "Let us reconnect next week to finalize the plan.",
    senderName: "Sam Lead",
    senderAddress: "sam@team.example",
    receivedAt: "2026-02-01T09:00:00.000Z",
    timeZone: "America/New_York",
  },
  ambiguousDates: {
    messageId: "msg-1003",
    subject: "Deadline questions",
    body: "The deadline might be 2026-03-01 or 2026-03-15, please confirm.",
    senderName: "Pat Client",
    senderAddress: "pat@client.example",
    receivedAt: "2026-02-20T09:00:00.000Z",
  },
  newsletter: {
    messageId: "msg-1004",
    subject: "Weekly newsletter: product updates",
    body: "This is our FYI newsletter. To stop receiving it, unsubscribe here.",
    senderName: "Updates",
    senderAddress: "updates@news.example",
    receivedAt: "2026-02-02T09:00:00.000Z",
  },
  noSignal: {
    messageId: "msg-1005",
    subject: "Photos from the trip",
    body: "Sharing some pictures from our vacation. Hope you like them.",
    senderName: "Jordan Friend",
    senderAddress: "jordan@friend.example",
    receivedAt: "2026-02-03T09:00:00.000Z",
  },
  explicitNoDate: {
    messageId: "msg-1006",
    subject: "Please follow up",
    body: "Remind me to follow up on this when you can.",
    senderAddress: "lee@team.example",
    receivedAt: "2026-02-04T09:00:00.000Z",
  },
};

export const sampleEmailList: NormalizedEmailInput[] = Object.values(sampleEmails);
