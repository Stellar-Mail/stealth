import type { TeamDigestItem } from "./digestGenerator";

export const teamDigestItems: TeamDigestItem[] = [
  {
    id: "item-1",
    author: "Alex",
    subject: "Weekly planning sync",
    project: "Roadmap",
    tags: ["planning", "team"],
    createdAt: "2026-06-01T09:00:00.000Z",
    isActionItem: true,
    summary: "Prepare agenda and update priorities.",
  },
  {
    id: "item-2",
    author: "Riya",
    subject: "Customer support backlog",
    project: "Support",
    tags: ["support", "triage"],
    createdAt: "2026-06-01T10:15:00.000Z",
    isActionItem: false,
    summary: "Review top 5 open tickets for the week.",
  },
  {
    id: "item-3",
    author: "Alex",
    subject: "Launch checklist review",
    project: "Product",
    tags: ["release", "review"],
    createdAt: "2026-06-01T11:30:00.000Z",
    isActionItem: true,
    summary: "Confirm QA signoff and feature gating.",
  },
  {
    id: "item-4",
    author: "Marina",
    subject: "Weekly planning sync",
    project: "Roadmap",
    tags: ["planning", "coordination"],
    createdAt: "2026-06-01T12:45:00.000Z",
    isActionItem: false,
    summary: "Align engineering and design priorities.",
  },
];
