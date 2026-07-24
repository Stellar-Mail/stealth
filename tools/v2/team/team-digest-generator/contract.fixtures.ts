/**
 * contract.fixtures.ts — Team Digest Generator (execution contract fixtures)
 *
 * Deterministic local fixtures used by the contract tests and as documentation
 * of the contract shape.
 */

import type { TeamDigestItem } from "./src/digestGenerator";

/** A small deterministic set of digest items across authors/projects/tags. */
export const DIGEST_FIXTURES: TeamDigestItem[] = [
  {
    id: "item-1",
    author: "Ada",
    subject: "Shipped onboarding flow",
    project: "onboarding",
    tags: ["release"],
    createdAt: "2026-06-01T09:00:00.000Z",
    isActionItem: false,
  },
  {
    id: "item-2",
    author: "Ada",
    subject: "Fix billing bug",
    project: "billing",
    tags: ["bug"],
    createdAt: "2026-06-01T10:30:00.000Z",
    isActionItem: true,
  },
  {
    id: "item-3",
    author: "Grace",
    subject: "Draft Q3 roadmap",
    project: "planning",
    tags: ["planning", "docs"],
    createdAt: "2026-06-02T11:00:00.000Z",
    isActionItem: false,
  },
  {
    id: "item-4",
    author: "Grace",
    subject: "Review security PR",
    project: "security",
    tags: ["review"],
    createdAt: "2026-06-02T14:00:00.000Z",
    isActionItem: true,
  },
];

/** An empty item set (edge case). */
export const EMPTY_ITEMS: TeamDigestItem[] = [];
