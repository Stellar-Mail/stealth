import { describe, expect, it } from "vitest";
import {
  detectConflicts,
  applyResolutions,
  type Conflict,
  type ConflictType,
  type ResolutionAction,
} from "../components/ConflictResolver";
import type { Draft } from "../types/draft";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<Draft> & { id: string }): Draft {
  return {
    subject: `Subject for ${overrides.id}`,
    body: `Body for ${overrides.id}`,
    recipients: [`user@${overrides.id}.demo`],
    ...overrides,
  };
}

// ─── detectConflicts ──────────────────────────────────────────────────────────

describe("detectConflicts", () => {
  it("returns empty array when there are no conflicts", () => {
    const existing = [makeDraft({ id: "a" }), makeDraft({ id: "b" })];
    const incoming = [makeDraft({ id: "c" }), makeDraft({ id: "d" })];

    const conflicts = detectConflicts(incoming, existing);
    expect(conflicts).toHaveLength(0);
  });

  it("detects duplicate-id conflict when same id but different subject", () => {
    const existing = [makeDraft({ id: "draft-1", subject: "Original Subject" })];
    const incoming = [makeDraft({ id: "draft-1", subject: "Modified Subject" })];

    const conflicts = detectConflicts(incoming, existing);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);

    const dupConflict = conflicts.find((c) => c.type === "duplicate-id");
    expect(dupConflict).toBeDefined();
    expect(dupConflict!.existing.subject).toBe("Original Subject");
    expect(dupConflict!.incoming.subject).toBe("Modified Subject");
  });

  it("detects duplicate-id conflict when same id but different body", () => {
    const existing = [makeDraft({ id: "draft-1", subject: "Same", body: "Old body" })];
    const incoming = [makeDraft({ id: "draft-1", subject: "Same", body: "New body" })];

    const conflicts = detectConflicts(incoming, existing);
    const dupConflict = conflicts.find((c) => c.type === "duplicate-id");
    expect(dupConflict).toBeDefined();
  });

  it("does NOT detect duplicate-id when id matches and subject/body are identical", () => {
    const draft = makeDraft({ id: "draft-1", subject: "Same", body: "Same body" });
    const existing = [draft];
    const incoming = [{ ...draft }];

    const conflicts = detectConflicts(incoming, existing);
    const dupConflict = conflicts.find((c) => c.type === "duplicate-id");
    expect(dupConflict).toBeUndefined();
  });

  it("detects sender-collision when same recipient domain but different content", () => {
    const existing = [
      makeDraft({ id: "e1", subject: "Existing", recipients: ["alice@acme.demo"] }),
    ];
    const incoming = [makeDraft({ id: "i1", subject: "Incoming", recipients: ["bob@acme.demo"] })];

    const conflicts = detectConflicts(incoming, existing);
    const senderConflict = conflicts.find((c) => c.type === "sender-collision");
    expect(senderConflict).toBeDefined();
  });

  it("detects label-conflict when same subject but different ID", () => {
    const existing = [makeDraft({ id: "e1", subject: "Newsletter #47" })];
    const incoming = [makeDraft({ id: "i1", subject: "Newsletter #47" })];

    const conflicts = detectConflicts(incoming, existing);
    const labelConflict = conflicts.find((c) => c.type === "label-conflict");
    expect(labelConflict).toBeDefined();
  });

  it("does not produce duplicate conflict entries for the same pair", () => {
    const existing = [makeDraft({ id: "d1", subject: "Test" })];
    const incoming = [makeDraft({ id: "d1", subject: "Test Changed" })];

    const conflicts = detectConflicts(incoming, existing);
    const ids = conflicts.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ─── applyResolutions ─────────────────────────────────────────────────────────

describe("applyResolutions", () => {
  it("appends non-conflicting incoming drafts", () => {
    const existing = [makeDraft({ id: "a" })];
    const incoming = [makeDraft({ id: "b" })];
    const conflicts: Conflict[] = [];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(2);
    expect(result.find((d) => d.id === "a")).toBeDefined();
    expect(result.find((d) => d.id === "b")).toBeDefined();
  });

  it("overwrites existing draft when resolution is 'overwrite'", () => {
    const existing = [makeDraft({ id: "d1", subject: "Old" })];
    const incoming = [makeDraft({ id: "d1", subject: "New" })];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: "overwrite",
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("New");
  });

  it("keeps existing draft when resolution is 'keep-existing'", () => {
    const existing = [makeDraft({ id: "d1", subject: "Old" })];
    const incoming = [makeDraft({ id: "d1", subject: "New" })];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: "keep-existing",
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Old");
  });

  it("keeps both drafts when resolution is 'keep-both'", () => {
    const existing = [makeDraft({ id: "d1", subject: "Old" })];
    const incoming = [makeDraft({ id: "d1", subject: "New" })];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: "keep-both",
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(2);
    expect(result[0].subject).toBe("Old");
    // The second one should have a renamed ID
    expect(result[1].id).toContain("merged");
    expect(result[1].subject).toBe("New");
  });

  it("merges recipients when resolution is 'merge-labels'", () => {
    const existing = [makeDraft({ id: "d1", recipients: ["alice@demo.com"] })];
    const incoming = [makeDraft({ id: "d1", recipients: ["bob@demo.com"] })];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: "merge-labels",
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(1);
    expect(result[0].recipients).toContain("alice@demo.com");
    expect(result[0].recipients).toContain("bob@demo.com");
  });

  it("defaults to 'keep-existing' when resolution is null", () => {
    const existing = [makeDraft({ id: "d1", subject: "Old" })];
    const incoming = [makeDraft({ id: "d1", subject: "New" })];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: null,
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe("Old");
  });

  it("does not duplicate non-conflicting incoming drafts that already exist", () => {
    const draft = makeDraft({ id: "d1", subject: "Same", body: "Same" });
    const existing = [draft];
    const incoming = [{ ...draft }];
    const conflicts: Conflict[] = [];

    const result = applyResolutions(incoming, existing, conflicts);
    expect(result).toHaveLength(1);
  });

  it("handles multiple conflicts correctly", () => {
    const existing = [
      makeDraft({ id: "d1", subject: "Existing A" }),
      makeDraft({ id: "d2", subject: "Existing B" }),
    ];
    const incoming = [
      makeDraft({ id: "d1", subject: "Incoming A" }),
      makeDraft({ id: "d2", subject: "Incoming B" }),
      makeDraft({ id: "d3", subject: "Brand New" }),
    ];
    const conflicts: Conflict[] = [
      {
        id: "dup-d1",
        type: "duplicate-id",
        incoming: incoming[0],
        existing: existing[0],
        resolution: "overwrite",
      },
      {
        id: "dup-d2",
        type: "duplicate-id",
        incoming: incoming[1],
        existing: existing[1],
        resolution: "keep-existing",
      },
    ];

    const result = applyResolutions(incoming, existing, conflicts);
    // d1 overwritten, d2 kept, d3 appended = 3 total
    expect(result).toHaveLength(3);
    expect(result.find((d) => d.id === "d1")!.subject).toBe("Incoming A");
    expect(result.find((d) => d.id === "d2")!.subject).toBe("Existing B");
    expect(result.find((d) => d.id === "d3")!.subject).toBe("Brand New");
  });
});
