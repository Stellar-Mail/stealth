import { describe, expect, it } from "vitest";

import { ownershipThreads } from "../fixtures/ownership-cases";
import { OwnershipTrackerService } from "../service";

describe("OwnershipTrackerService", () => {
  it("assigns an unowned thread to the requesting teammate", () => {
    const service = new OwnershipTrackerService(ownershipThreads);

    const assigned = service.claimThread("thread-enterprise-renewal", {
      teammateId: "agent-lina",
      teammateName: "Lina",
      now: "2026-06-17T10:00:00Z",
    });

    expect(assigned).toMatchObject({
      id: "thread-enterprise-renewal",
      status: "assigned",
      ownerId: "agent-lina",
      ownerName: "Lina",
      updatedAt: "2026-06-17T10:00:00Z",
    });
  });

  it("rejects a claim when another teammate already owns the thread", () => {
    const service = new OwnershipTrackerService(ownershipThreads);

    expect(() =>
      service.claimThread("thread-delivery-proof", {
        teammateId: "agent-lina",
        teammateName: "Lina",
        now: "2026-06-17T10:00:00Z",
      }),
    ).toThrow("Thread is already owned by Mika.");
  });

  it("allows a released thread to be claimed again", () => {
    const service = new OwnershipTrackerService(ownershipThreads);

    const assigned = service.claimThread("thread-refund-policy", {
      teammateId: "agent-omar",
      teammateName: "Omar",
      now: "2026-06-17T10:05:00Z",
    });

    expect(assigned.status).toBe("assigned");
    expect(assigned.ownerId).toBe("agent-omar");
  });

  it("releases only the current owner of a thread", () => {
    const service = new OwnershipTrackerService(ownershipThreads);

    expect(() =>
      service.releaseThread("thread-delivery-proof", {
        teammateId: "agent-lina",
        now: "2026-06-17T10:08:00Z",
      }),
    ).toThrow("Only the current owner can release this thread.");

    const released = service.releaseThread("thread-delivery-proof", {
      teammateId: "agent-mika",
      now: "2026-06-17T10:10:00Z",
    });

    expect(released).toMatchObject({
      status: "released",
      ownerId: null,
      ownerName: null,
      updatedAt: "2026-06-17T10:10:00Z",
    });
  });

  it("returns defensive copies of stored threads", () => {
    const service = new OwnershipTrackerService(ownershipThreads);
    const [first] = service.listThreads();
    first.subject = "mutated outside the service";

    expect(service.getThread(first.id).subject).toBe("Enterprise renewal timing");
  });

  it("records claim and release history for review", () => {
    const service = new OwnershipTrackerService(ownershipThreads);

    service.claimThread("thread-enterprise-renewal", {
      teammateId: "agent-lina",
      teammateName: "Lina",
      now: "2026-06-17T10:00:00Z",
    });
    service.releaseThread("thread-enterprise-renewal", {
      teammateId: "agent-lina",
      now: "2026-06-17T10:30:00Z",
    });

    expect(service.getHistory("thread-enterprise-renewal")).toEqual([
      {
        threadId: "thread-enterprise-renewal",
        type: "claimed",
        teammateId: "agent-lina",
        teammateName: "Lina",
        occurredAt: "2026-06-17T10:00:00Z",
      },
      {
        threadId: "thread-enterprise-renewal",
        type: "released",
        teammateId: "agent-lina",
        teammateName: null,
        occurredAt: "2026-06-17T10:30:00Z",
      },
    ]);
  });
});
