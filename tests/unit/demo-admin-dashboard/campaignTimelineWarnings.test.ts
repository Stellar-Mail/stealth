import { describe, expect, it } from "vitest";
import {
  isOverdue,
  isImminent,
} from "@/features/demo-admin-dashboard/components/CampaignTimelinePanel";
import {
  activeCampaignTimeline,
  draftCampaignTimeline,
} from "@/features/demo-admin-dashboard/fixtures/campaignTimelineFixtures";
import { getDemoNow } from "@/features/demo-admin-dashboard/snooze/referenceNow";
import { getTimelineDateRange } from "@/features/demo-admin-dashboard/utils/campaignTimelineHelpers";

const demoNow = getDemoNow(); // 2026-06-16T09:00:00

describe("isOverdue", () => {
  it("returns false for a resolved milestone", () => {
    const ms = activeCampaignTimeline.milestones.find((m) => m.id === "ms-001")!;
    expect(ms.status).toBe("resolved");
    expect(isOverdue(ms, demoNow)).toBe(false);
  });

  it("returns false for a pending milestone not yet due (ms-002, due 2026-06-23)", () => {
    const ms = activeCampaignTimeline.milestones.find((m) => m.id === "ms-002")!;
    expect(ms.status).toBe("pending");
    expect(isOverdue(ms, demoNow)).toBe(false);
  });

  it("returns true for a pending milestone whose dueAt is in the past", () => {
    const pastMilestone = {
      id: "ms-past",
      kind: "review" as const,
      label: "Past Review",
      dueAt: "2026-06-10T09:00",
      status: "pending" as const,
    };
    expect(isOverdue(pastMilestone, demoNow)).toBe(true);
  });

  it("returns false for a skipped milestone even if dueAt is in the past", () => {
    const skippedMilestone = {
      id: "ms-skip",
      kind: "custom" as const,
      label: "Skipped",
      dueAt: "2026-06-01T00:00",
      status: "skipped" as const,
    };
    expect(isOverdue(skippedMilestone, demoNow)).toBe(false);
  });
});

describe("isImminent", () => {
  it("returns false for a send that is already sent (send-001)", () => {
    const send = activeCampaignTimeline.sends.find((s) => s.id === "send-001")!;
    expect(send.status).toBe("sent");
    expect(isImminent(send, demoNow)).toBe(false);
  });

  it("returns true for a pending send scheduled 3 days out (send-002, 2026-06-19)", () => {
    const send = activeCampaignTimeline.sends.find((s) => s.id === "send-002")!;
    expect(send.status).toBe("pending");
    // demoNow is 2026-06-16; send is 2026-06-19 → diff ~3 days → within window
    expect(isImminent(send, demoNow)).toBe(true);
  });

  it("returns false for a pending send 9 days out (send-003, 2026-06-25)", () => {
    const send = activeCampaignTimeline.sends.find((s) => s.id === "send-003")!;
    expect(send.status).toBe("pending");
    expect(isImminent(send, demoNow)).toBe(false);
  });

  it("returns false for a pending send already past", () => {
    const pastSend = {
      id: "s-past",
      phaseId: "phase-003",
      label: "Past send",
      scheduledAt: "2026-06-10T09:00",
      recipientSegmentId: "investors" as const,
      estimatedCount: 100,
      status: "pending" as const,
    };
    // diff is negative — already past
    expect(isImminent(pastSend, demoNow)).toBe(false);
  });
});

describe("getTimelineDateRange", () => {
  it("returns correct start and end for the active timeline", () => {
    const range = getTimelineDateRange(activeCampaignTimeline);
    expect(range).not.toBeNull();
    expect(range!.startsAt).toBe("2026-05-01T00:00");
    expect(range!.endsAt).toBe("2026-06-30T23:59");
  });

  it("returns null for a timeline with no phases", () => {
    const empty = { ...activeCampaignTimeline, phases: [] };
    expect(getTimelineDateRange(empty)).toBeNull();
  });

  it("returns correct start for draft timeline", () => {
    const range = getTimelineDateRange(draftCampaignTimeline);
    expect(range).not.toBeNull();
    expect(range!.startsAt).toBe("2026-07-01T00:00");
  });
});

describe("phase bar width calculation", () => {
  it("produces widths that sum to 100% for the active timeline", () => {
    const range = getTimelineDateRange(activeCampaignTimeline)!;
    const totalStart = new Date(range.startsAt).getTime();
    const totalEnd = new Date(range.endsAt).getTime();
    const totalMs = totalEnd - totalStart;

    const totalWidth = activeCampaignTimeline.phases.reduce((sum, phase) => {
      const phaseStart = new Date(phase.startAt).getTime();
      const phaseEnd = new Date(phase.endAt).getTime();
      return sum + ((phaseEnd - phaseStart) / totalMs) * 100;
    }, 0);

    expect(totalWidth).toBeCloseTo(100, 0);
  });

  it("positions the 'now' needle between 0 and 100 for the active timeline", () => {
    const range = getTimelineDateRange(activeCampaignTimeline)!;
    const totalStart = new Date(range.startsAt).getTime();
    const totalEnd = new Date(range.endsAt).getTime();
    const totalMs = totalEnd - totalStart;

    const nowPct = ((demoNow.getTime() - totalStart) / totalMs) * 100;
    expect(nowPct).toBeGreaterThan(0);
    expect(nowPct).toBeLessThan(100);
  });
});
