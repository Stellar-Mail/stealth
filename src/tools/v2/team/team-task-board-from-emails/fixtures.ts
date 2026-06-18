import { EmailFixture } from "./types";

export const mockEmails: EmailFixture[] = [
  {
    id: "email-001",
    from: "amara@grantfox.io",
    to: ["team@grantfox.io"],
    subject: "Sprint kickoff tasks",
    body: `Hi team,\n\nPlease make sure the following gets done this week:\n\n- Kofi needs to finish the onboarding flow by Friday 2024-02-09.\n- Bisi should review the payment integration PR by tomorrow.\n- Everyone: update your status in Notion by end of day.\n\nThanks,\nAmara`,
    receivedAt: "2024-02-05T09:00:00Z",
  },
  {
    id: "email-002",
    from: "kofi@grantfox.io",
    to: ["amara@grantfox.io"],
    subject: "Re: design handoff",
    body: `Amara,\n\nI'll handle the mobile responsive fixes. Target is 2024-02-12.\nCan you assign the accessibility audit to Bisi? No hard deadline yet.\n\nKofi`,
    receivedAt: "2024-02-05T11:30:00Z",
  },
  {
    id: "email-003",
    from: "bisi@grantfox.io",
    to: ["team@grantfox.io"],
    subject: "Bug triage",
    body: `Team,\n\nTwo things that need owners:\n\n1. Fix the CSV export crash — due 2024-02-08, assigning to Kofi.\n2. Write regression tests for the auth flow. Unassigned for now, due 2024-02-15.\n\nBisi`,
    receivedAt: "2024-02-06T08:15:00Z",
  },
  {
    id: "email-004",
    from: "amara@grantfox.io",
    to: ["kofi@grantfox.io"],
    subject: "Quick reminder",
    body: `Kofi, just a reminder to deploy the staging build before the call today.`,
    receivedAt: "2024-02-06T10:00:00Z",
  },
  {
    id: "email-005",
    from: "noreply@calendar.app",
    to: ["team@grantfox.io"],
    subject: "Meeting invite: Weekly sync",
    body: `You have been invited to Weekly Sync on 2024-02-07 at 10:00 AM.`,
    receivedAt: "2024-02-06T12:00:00Z",
  },
];
