import { describe, expect, it } from "vitest";
import { generateTeamDigest, type TeamDigestItem } from "./digestGenerator";

const items: TeamDigestItem[] = [
  {
    id: "item-1",
    author: "Alex",
    subject: "Weekly planning sync",
    project: "Roadmap",
    tags: ["planning", "team"],
    createdAt: "2026-06-01T09:00:00.000Z",
    isActionItem: true,
  },
  {
    id: "item-2",
    author: "Riya",
    subject: "Customer support backlog",
    project: "Support",
    tags: ["support", "triage"],
    createdAt: "2026-06-01T10:15:00.000Z",
    isActionItem: false,
  },
  {
    id: "item-3",
    author: "Alex",
    subject: "Launch checklist review",
    project: "Product",
    tags: ["release", "review"],
    createdAt: "2026-06-01T11:30:00.000Z",
    isActionItem: true,
  },
  {
    id: "item-4",
    author: "Marina",
    subject: "Weekly planning sync",
    project: "Roadmap",
    tags: ["planning", "coordination"],
    createdAt: "2026-06-01T12:45:00.000Z",
    isActionItem: false,
  },
];

describe("generateTeamDigest", () => {
  it("summarizes authors, projects, tags, and action items", () => {
    const summary = generateTeamDigest(items, { topSubjectLimit: 3 });

    expect(summary.totalItems).toBe(4);
    expect(summary.authors).toEqual({ Alex: 2, Riya: 1, Marina: 1 });
    expect(summary.projects).toEqual({ Roadmap: 2, Support: 1, Product: 1 });
    expect(summary.tags).toEqual({
      planning: 2,
      team: 1,
      support: 1,
      triage: 1,
      release: 1,
      review: 1,
      coordination: 1,
    });
    expect(summary.actionItems).toHaveLength(2);
    expect(summary.topSubjects).toEqual([
      "Weekly planning sync",
      "Customer support backlog",
      "Launch checklist review",
    ]);
    expect(new Date(summary.generatedAt).toString()).not.toBe("Invalid Date");
  });

  it("returns an empty summary for no items", () => {
    const summary = generateTeamDigest([]);

    expect(summary.totalItems).toBe(0);
    expect(summary.authors).toEqual({});
    expect(summary.projects).toEqual({});
    expect(summary.tags).toEqual({});
    expect(summary.actionItems).toHaveLength(0);
    expect(summary.topSubjects).toEqual([]);
  });
});
