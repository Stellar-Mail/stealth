/**
 * drafts.fixtures.mjs — Shared Draft Collaboration
 *
 * Deterministic local fixtures. No network calls, no secrets.
 */

export const DRAFT_FIXTURES = [
  {
    id: "draft-001",
    title: "Q1 Team Updates",
    subject: "Monthly updates for leadership",
    lastModified: "2026-06-01T14:30:00Z",
    collaborators: 3,
    isActive: true,
  },
  {
    id: "draft-002",
    title: "Project Proposal - Feature X",
    subject: "New product feature proposal",
    lastModified: "2026-06-05T10:15:00Z",
    collaborators: 2,
    isActive: false,
  },
  {
    id: "draft-003",
    title: "Customer Response Template",
    subject: "Template for common customer inquiries",
    lastModified: "2026-06-08T16:45:00Z",
    collaborators: 4,
    isActive: false,
  },
  {
    id: "draft-004",
    title: "Security Incident Report",
    subject: "Incident report for review",
    lastModified: "2026-06-10T09:00:00Z",
    collaborators: 1,
    isActive: true,
  },
];

export const ACTIVE_DRAFTS = DRAFT_FIXTURES.filter((d) => d.isActive);
export const INACTIVE_DRAFTS = DRAFT_FIXTURES.filter((d) => !d.isActive);
