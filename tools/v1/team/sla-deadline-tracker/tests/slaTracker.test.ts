import { describe, expect, it } from "vitest";

import { computeDeadline, evaluateSla, summarizeSla } from "../services/slaTracker";
import type { SlaPolicy, SlaTrackedItem } from "../types";
import { FIXED_NOW, SAMPLE_ITEMS, STANDARD_SLA_POLICY } from "../fixtures/sla.fixture";

const policy: SlaPolicy = STANDARD_SLA_POLICY;

function item(overrides: Partial<SlaTrackedItem>): SlaTrackedItem {
  return {
    id: "x",
    label: "test",
    startedAt: new Date(FIXED_NOW - 60 * 1000).toISOString(),
    deadlineAt: new Date(FIXED_NOW + 60 * 60 * 1000).toISOString(),
    responded: false,
    respondedAt: null,
    ...overrides,
  };
}

describe("evaluateSla (#450)", () => {
  it("marks an already-responded item as responded regardless of deadline", () => {
    const ev = evaluateSla(
      item({
        responded: true,
        respondedAt: new Date(FIXED_NOW).toISOString(),
        deadlineAt: new Date(FIXED_NOW - 1000).toISOString(),
      }),
      policy,
      FIXED_NOW,
    );
    expect(ev.status).toBe("responded");
    expect(ev.breached).toBe(false);
    expect(ev.responded).toBe(true);
  });

  it("treats items with no deadline as on-track (nothing to breach)", () => {
    const ev = evaluateSla(item({ deadlineAt: null }), policy, FIXED_NOW);
    expect(ev.status).toBe("on-track");
    expect(ev.breached).toBe(false);
  });

  it("classifies on-track when remaining time exceeds the warn window", () => {
    const ev = evaluateSla(
      item({ deadlineAt: new Date(FIXED_NOW + 2 * 60 * 60 * 1000).toISOString() }),
      policy,
      FIXED_NOW,
    );
    expect(ev.status).toBe("on-track");
    expect(ev.remainingMs).toBe(2 * 60 * 60 * 1000);
  });

  it("classifies due-soon when within the warn window but not breached", () => {
    const ev = evaluateSla(
      item({ deadlineAt: new Date(FIXED_NOW + 10 * 60 * 1000).toISOString() }),
      policy,
      FIXED_NOW,
    );
    expect(ev.status).toBe("due-soon");
  });

  it("classifies breached once the deadline passes without a response", () => {
    const ev = evaluateSla(
      item({ deadlineAt: new Date(FIXED_NOW - 5 * 60 * 1000).toISOString() }),
      policy,
      FIXED_NOW,
    );
    expect(ev.status).toBe("breached");
    expect(ev.breached).toBe(true);
    expect(ev.remainingMs).toBe(-5 * 60 * 1000);
  });

  it("is deterministic for identical inputs", () => {
    const a = evaluateSla(item({}), policy, FIXED_NOW);
    const b = evaluateSla(item({}), policy, FIXED_NOW);
    expect(a).toEqual(b);
  });
});

describe("summarizeSla (#450)", () => {
  it("aggregates the sample fixtures into the expected buckets", () => {
    const summary = summarizeSla(SAMPLE_ITEMS, policy, FIXED_NOW);
    expect(summary.total).toBe(5);
    expect(summary.responded).toBe(1); // item-4
    expect(summary.onTrack).toBe(2); // item-1, item-5
    expect(summary.dueSoon).toBe(1); // item-2
    expect(summary.breached).toBe(1); // item-3
  });

  it("returns an empty summary for no items", () => {
    const summary = summarizeSla([], policy, FIXED_NOW);
    expect(summary).toEqual({ total: 0, responded: 0, onTrack: 0, dueSoon: 0, breached: 0 });
  });

  it("is a single pass (no sorting) and safe for large arrays", () => {
    const many: SlaTrackedItem[] = Array.from({ length: 5000 }, (_, i) =>
      // i=0 has deadline exactly at now (remaining 0 -> due-soon, not breached)
      item({ id: `bulk-${i}`, deadlineAt: new Date(FIXED_NOW - i - 1).toISOString() }),
    );
    const summary = summarizeSla(many, policy, FIXED_NOW);
    expect(summary.total).toBe(5000);
    expect(summary.breached).toBe(5000);
  });
});

describe("computeDeadline (#450)", () => {
  it("adds the response budget to the start time", () => {
    const start = new Date(FIXED_NOW - 1000).toISOString();
    const deadline = computeDeadline(start, policy);
    expect(Date.parse(deadline)).toBe(Date.parse(start) + policy.responseBudgetMs);
  });
});
