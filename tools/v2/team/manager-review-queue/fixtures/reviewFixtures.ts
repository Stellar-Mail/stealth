import { ReviewItem } from "../types";

export const mockQueueItems: ReviewItem[] = [
  {
    id: "rev_001",
    submitterId: "usr_892",
    contentSnippet: "Please approve this bulk wire transfer to offshore account.",
    submittedAt: "2026-06-18T10:00:00Z",
    status: "pending",
    riskScore: 85,
  },
  {
    id: "rev_002",
    submitterId: "usr_105",
    contentSnippet: "Update to marketing newsletter template",
    submittedAt: "2026-06-18T11:30:00Z",
    status: "pending",
    riskScore: 12,
  },
  {
    id: "rev_003",
    submitterId: "usr_422",
    contentSnippet: "Password reset request override",
    submittedAt: "2026-06-17T15:45:00Z",
    status: "escalated",
    riskScore: 92,
  },
  {
    id: "rev_004",
    submitterId: "usr_892",
    contentSnippet: "New vendor onboarding documents",
    submittedAt: "2026-06-16T09:15:00Z",
    status: "approved",
    riskScore: 35,
  },
];

export const MOCK_NETWORK_DELAY_MS = 500;
