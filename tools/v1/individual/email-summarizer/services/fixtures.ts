import type { NormalizedEmail } from "./emailSummarizer";

export interface SummarizerFixture {
  id: string;
  description: string;
  email: NormalizedEmail;
}

/**
 * Deterministic, synthetic emails used for tests, docs, and future UI previews.
 * None of these contain real personal data.
 */
export const SAMPLE_EMAILS: SummarizerFixture[] = [
  {
    id: "project-update",
    description: "Status update with a single clear action item.",
    email: {
      subject: "Weekly project update",
      sender: "alex@example.com",
      receivedAt: "2026-01-02T10:00:00.000Z",
      body: "The release is on track for Friday. The team finished the API work yesterday. Please review the changelog before the demo. We also fixed three importer bugs.",
    },
  },
  {
    id: "invoice-reminder",
    description: "Reminder email with multiple action items.",
    email: {
      subject: "Invoice 1042 reminder",
      sender: "billing@example.com",
      receivedAt: "2026-01-05T08:30:00.000Z",
      body: "Your invoice is due next week. Please confirm the billing address on file. Can you send the updated purchase order by end of day? Thanks for your continued partnership.",
    },
  },
];

export const EMPTY_BODY_EMAIL: NormalizedEmail = {
  subject: "No content",
  sender: "noreply@example.com",
  receivedAt: "2026-01-06T12:00:00.000Z",
  body: "   ",
};
