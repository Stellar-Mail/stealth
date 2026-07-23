/**
 * Deterministic local fixtures for the Shared Team Inbox (#445).
 *
 * No production data. IDs and timestamps are fixed so tests are reproducible.
 */
import type { TeamMessage, TriageRecord } from "../types";

export const SAMPLE_MESSAGES: TeamMessage[] = [
  {
    id: "msg-001",
    sender: "client@external.example",
    subject: "Cannot log in to dashboard",
    preview: "We get a 500 error when submitting the login form.",
    receivedAt: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "msg-002",
    sender: "partner@vendor.example",
    subject: "Q3 invoice follow-up",
    preview: "Just checking on the status of invoice #2231.",
    receivedAt: "2026-07-20T10:30:00.000Z",
  },
  {
    id: "msg-003",
    sender: "user@external.example",
    subject: "Feature request: dark mode",
    preview: "Would love a dark theme for the mail client.",
    receivedAt: "2026-07-20T11:15:00.000Z",
  },
];

/** One message already triaged, to exercise non-empty-store paths. */
export const SEEDED_RECORD: TriageRecord = {
  message: SAMPLE_MESSAGES[0],
  status: "claimed",
  assignee: "alice",
  annotations: [],
  replies: [],
  updatedAt: "2026-07-20T09:05:00.000Z",
};
