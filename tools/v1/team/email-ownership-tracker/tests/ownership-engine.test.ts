import { describe, expect, it } from "vitest";

import { sortOwnershipEvents, trackOwnership } from "../services/email-ownership-tracker.service";
import type { ActorId, OwnershipEvent } from "../types/ownership";

// Coverage for the real ownership engine. The existing ownership-fixtures test
// only validates the JSON fixture's shape and never calls trackOwnership, so
// none of the engine's state transitions or anomaly branches were exercised.
// This suite runs the engine directly. Folder-local; touches no other files.

function event(
  id: string,
  action: OwnershipEvent["action"],
  extra: {
    threadId?: string;
    actor?: string;
    owner?: ActorId | null;
    previousOwner?: ActorId | null;
    timestamp?: string;
    note?: string;
  } = {},
): OwnershipEvent {
  return {
    id,
    threadId: extra.threadId ?? "thread-1.test",
    action,
    actor: extra.actor ?? "lead@team.test",
    owner: extra.owner ?? null,
    previousOwner: extra.previousOwner,
    timestamp: extra.timestamp ?? "2026-07-01T09:00:00Z",
    note: extra.note,
  };
}

describe("trackOwnership state transitions", () => {
  it("returns an empty report for no events", () => {
    const report = trackOwnership([]);
    expect(report.records).toEqual([]);
    expect(report.anomalies).toEqual([]);
    expect(report.summary).toEqual({
      totalEvents: 0,
      totalThreads: 0,
      ownedThreads: 0,
      unassignedThreads: 0,
      totalHandoffs: 0,
      anomalies: 0,
    });
  });

  it("marks a thread owned after an assignment and records history", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
        note: "Initial triage.",
      }),
    ]);

    const record = report.records[0];
    expect(record.state).toBe("owned");
    expect(record.currentOwner).toBe("alice@team.test");
    expect(record.handoffCount).toBe(0);
    expect(record.history).toHaveLength(1);
    expect(record.history[0].previousOwner).toBeNull();
    expect(record.history[0].note).toBe("Initial triage.");
    expect(report.summary.ownedThreads).toBe(1);
    expect(report.anomalies).toHaveLength(0);
  });

  it("treats a claim on an unowned thread like an assignment", () => {
    const report = trackOwnership([
      event("evt-1", "claimed", {
        owner: "carol@team.test",
        previousOwner: null,
      }),
    ]);
    const record = report.records[0];
    expect(record.state).toBe("owned");
    expect(record.currentOwner).toBe("carol@team.test");
    expect(record.handoffCount).toBe(0);
    expect(record.history[0].note).toBeNull();
    expect(report.anomalies).toHaveLength(0);
  });

  it("counts a handoff when ownership moves to a different owner", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "reassigned", {
        owner: "bob@team.test",
        previousOwner: "alice@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);
    const record = report.records[0];
    expect(record.currentOwner).toBe("bob@team.test");
    expect(record.handoffCount).toBe(1);
    expect(report.summary.totalHandoffs).toBe(1);
    expect(report.anomalies).toHaveLength(0);
  });

  it("does not count a handoff when reassigned to the same owner", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "reassigned", {
        owner: "alice@team.test",
        previousOwner: "alice@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);
    const record = report.records[0];
    expect(record.currentOwner).toBe("alice@team.test");
    expect(record.handoffCount).toBe(0);
    expect(report.anomalies).toHaveLength(0);
  });

  it("marks a thread unassigned after a release", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "released", {
        owner: null,
        previousOwner: "alice@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);
    const record = report.records[0];
    expect(record.state).toBe("unassigned");
    expect(record.currentOwner).toBeNull();
    expect(report.summary.unassignedThreads).toBe(1);
    expect(report.summary.ownedThreads).toBe(0);
    expect(report.anomalies).toHaveLength(0);
  });
});

describe("trackOwnership anomaly detection", () => {
  it("flags a duplicate assignment to the current owner", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "assigned", {
        owner: "alice@team.test",
        previousOwner: "alice@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0].code).toBe("duplicate-owner-assignment");
    expect(report.anomalies[0].eventId).toBe("evt-2");
    expect(report.records[0].handoffCount).toBe(0);
  });

  it("flags a reassignment when there is no existing owner", () => {
    const report = trackOwnership([event("evt-1", "reassigned", { owner: "bob@team.test" })]);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0].code).toBe("reassign-without-existing-owner");
    expect(report.records[0].currentOwner).toBe("bob@team.test");
  });

  it("flags a release when there is no active owner", () => {
    const report = trackOwnership([event("evt-1", "released", { owner: null })]);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0].code).toBe("release-without-owner");
    expect(report.records[0].state).toBe("unassigned");
  });

  it("flags an owner mismatch when previousOwner does not match", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "reassigned", {
        owner: "bob@team.test",
        previousOwner: "wrong@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);
    const mismatch = report.anomalies.find((a) => a.code === "owner-mismatch");
    expect(mismatch).toBeDefined();
    expect(mismatch!.eventId).toBe("evt-2");
    expect(report.records[0].currentOwner).toBe("bob@team.test");
  });

  it("flags an out-of-order timestamp and still tracks first/last event times", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        owner: "alice@team.test",
        previousOwner: null,
        timestamp: "2026-07-02T10:00:00Z",
      }),
      event("evt-2", "released", {
        owner: null,
        previousOwner: "alice@team.test",
        timestamp: "2026-07-01T09:00:00Z",
      }),
    ]);
    expect(report.anomalies).toHaveLength(1);
    expect(report.anomalies[0].code).toBe("out-of-order-timestamp");
    const record = report.records[0];
    expect(record.firstEventAt).toBe("2026-07-01T09:00:00Z");
    expect(record.lastEventAt).toBe("2026-07-02T10:00:00Z");
  });
});

describe("trackOwnership aggregation across threads", () => {
  it("summarizes owned, unassigned, handoff, and anomaly totals", () => {
    const report = trackOwnership([
      event("evt-1", "assigned", {
        threadId: "t1.test",
        owner: "alice@team.test",
        previousOwner: null,
      }),
      event("evt-2", "assigned", {
        threadId: "t2.test",
        owner: "xavier@team.test",
        previousOwner: null,
      }),
      event("evt-3", "reassigned", {
        threadId: "t2.test",
        owner: "yolanda@team.test",
        previousOwner: "xavier@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
      event("evt-4", "assigned", {
        threadId: "t3.test",
        owner: "mia@team.test",
        previousOwner: null,
      }),
      event("evt-5", "released", {
        threadId: "t3.test",
        owner: null,
        previousOwner: "mia@team.test",
        timestamp: "2026-07-02T09:00:00Z",
      }),
    ]);

    expect(report.summary).toEqual({
      totalEvents: 5,
      totalThreads: 3,
      ownedThreads: 2,
      unassignedThreads: 1,
      totalHandoffs: 1,
      anomalies: 0,
    });
  });
});

describe("sortOwnershipEvents", () => {
  it("returns a chronologically sorted copy without mutating the input", () => {
    const input = [
      event("evt-late", "assigned", {
        owner: "alice@team.test",
        timestamp: "2026-07-05T09:00:00Z",
      }),
      event("evt-early", "assigned", {
        owner: "bob@team.test",
        timestamp: "2026-07-01T09:00:00Z",
      }),
    ];
    const sorted = sortOwnershipEvents(input);

    expect(sorted).not.toBe(input);
    expect(sorted.map((e) => e.id)).toEqual(["evt-early", "evt-late"]);
    expect(input.map((e) => e.id)).toEqual(["evt-late", "evt-early"]);
  });
});
