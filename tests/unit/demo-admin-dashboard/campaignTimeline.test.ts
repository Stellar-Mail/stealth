import { describe, expect, it } from "vitest";
import type {
  CampaignPhase,
  CampaignTimeline,
} from "../../../src/features/demo-admin-dashboard/types/campaignTimeline";
import {
  activeCampaignTimeline,
  draftCampaignTimeline,
} from "../../../src/features/demo-admin-dashboard/fixtures/campaignTimelineFixtures";
import {
  getActivePhase,
  getPhaseDurationDays,
  getSendsInWindow,
  getTimelineDateRange,
  getUpcomingMilestones,
  isDateInPhase,
  sortPhasesByStartDate,
  validateCampaignTimeline,
  validateMilestones,
  validatePhases,
  validatePreviewWindows,
  validateScheduledSends,
} from "../../../src/features/demo-admin-dashboard/utils/campaignTimelineHelpers";

const REF_NOW = new Date("2026-06-16T09:00");

// ---------------------------------------------------------------------------
// isDateInPhase
// ---------------------------------------------------------------------------

describe("isDateInPhase", () => {
  const phase: CampaignPhase = {
    id: "p",
    phaseKind: "active",
    label: "Active",
    startAt: "2026-06-01T00:00",
    endAt: "2026-06-30T23:59",
    status: "active",
  };

  it("returns true when date is within the phase window", () => {
    expect(isDateInPhase(new Date("2026-06-16T09:00"), phase)).toBe(true);
  });

  it("returns true on the boundary start date", () => {
    expect(isDateInPhase(new Date("2026-06-01T00:00"), phase)).toBe(true);
  });

  it("returns false when date is before the phase", () => {
    expect(isDateInPhase(new Date("2026-05-31T23:59"), phase)).toBe(false);
  });

  it("returns false when date is after the phase", () => {
    expect(isDateInPhase(new Date("2026-07-01T00:00"), phase)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActivePhase
// ---------------------------------------------------------------------------

describe("getActivePhase", () => {
  it("returns the phase containing REF_NOW", () => {
    const phase = getActivePhase(activeCampaignTimeline, REF_NOW);
    expect(phase).toBeDefined();
    expect(phase?.id).toBe("phase-003");
    expect(phase?.phaseKind).toBe("active");
  });

  it("returns undefined when no phase contains the date", () => {
    const result = getActivePhase(activeCampaignTimeline, new Date("2025-01-01T00:00"));
    expect(result).toBeUndefined();
  });

  it("returns undefined for a timeline with no phases", () => {
    const empty: CampaignTimeline = { ...activeCampaignTimeline, phases: [] };
    expect(getActivePhase(empty, REF_NOW)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPhaseDurationDays
// ---------------------------------------------------------------------------

describe("getPhaseDurationDays", () => {
  it("returns correct day count for a 14-day phase", () => {
    const phase = activeCampaignTimeline.phases.find((p) => p.id === "phase-001")!;
    expect(getPhaseDurationDays(phase)).toBe(13);
  });

  it("returns 0 for a same-day phase", () => {
    const phase: CampaignPhase = {
      id: "x",
      phaseKind: "planning",
      label: "Same Day",
      startAt: "2026-06-01T00:00",
      endAt: "2026-06-01T23:59",
      status: "upcoming",
    };
    expect(getPhaseDurationDays(phase)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// sortPhasesByStartDate
// ---------------------------------------------------------------------------

describe("sortPhasesByStartDate", () => {
  it("returns phases ordered by startAt ascending", () => {
    const shuffled = [...activeCampaignTimeline.phases].reverse();
    const sorted = sortPhasesByStartDate(shuffled);
    const ids = sorted.map((p) => p.id);
    expect(ids).toEqual(["phase-001", "phase-002", "phase-003", "phase-004"]);
  });

  it("does not mutate the input array", () => {
    const original = [...activeCampaignTimeline.phases].reverse();
    const originalIds = original.map((p) => p.id);
    sortPhasesByStartDate(original);
    expect(original.map((p) => p.id)).toEqual(originalIds);
  });
});

// ---------------------------------------------------------------------------
// getUpcomingMilestones
// ---------------------------------------------------------------------------

describe("getUpcomingMilestones", () => {
  it("returns only milestones due after the from date", () => {
    const upcoming = getUpcomingMilestones(activeCampaignTimeline, REF_NOW);
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].id).toBe("ms-002");
  });

  it("returns all milestones when from is far in the past", () => {
    const all = getUpcomingMilestones(activeCampaignTimeline, new Date("2020-01-01T00:00"));
    expect(all.length).toBe(activeCampaignTimeline.milestones.length);
  });

  it("returns empty array when from is in the future", () => {
    const none = getUpcomingMilestones(activeCampaignTimeline, new Date("2030-01-01T00:00"));
    expect(none).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSendsInWindow
// ---------------------------------------------------------------------------

describe("getSendsInWindow", () => {
  it("returns only the sends referenced by the preview window", () => {
    const window = activeCampaignTimeline.previewWindows[0];
    const sends = getSendsInWindow(activeCampaignTimeline, window);
    const ids = sends.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["send-001", "send-002"]));
    expect(ids).not.toContain("send-003");
  });

  it("returns empty array when sendIds is empty", () => {
    const emptyWindow = { ...activeCampaignTimeline.previewWindows[0], sendIds: [] };
    expect(getSendsInWindow(activeCampaignTimeline, emptyWindow)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getTimelineDateRange
// ---------------------------------------------------------------------------

describe("getTimelineDateRange", () => {
  it("returns the earliest startAt and latest endAt", () => {
    const range = getTimelineDateRange(activeCampaignTimeline);
    expect(range).not.toBeNull();
    expect(range?.startsAt).toBe("2026-05-01T00:00");
    expect(range?.endsAt).toBe("2026-06-30T23:59");
  });

  it("returns null for an empty phases array", () => {
    const empty: CampaignTimeline = { ...activeCampaignTimeline, phases: [] };
    expect(getTimelineDateRange(empty)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validatePhases
// ---------------------------------------------------------------------------

describe("validatePhases", () => {
  it("returns no issues for a valid phase sequence", () => {
    expect(validatePhases(activeCampaignTimeline.phases)).toHaveLength(0);
  });

  it("emits an error when startAt >= endAt", () => {
    const bad: CampaignPhase = {
      id: "bad-phase",
      phaseKind: "planning",
      label: "Bad Phase",
      startAt: "2026-06-10T00:00",
      endAt: "2026-06-01T00:00",
      status: "upcoming",
    };
    const issues = validatePhases([bad]);
    expect(issues.some((i) => i.severity === "error" && i.fieldPath.includes("endAt"))).toBe(true);
  });

  it("emits an error when two phases overlap", () => {
    const a: CampaignPhase = {
      id: "a",
      phaseKind: "planning",
      label: "A",
      startAt: "2026-06-01T00:00",
      endAt: "2026-06-20T23:59",
      status: "active",
    };
    const b: CampaignPhase = {
      id: "b",
      phaseKind: "warmup",
      label: "B",
      startAt: "2026-06-10T00:00",
      endAt: "2026-06-30T23:59",
      status: "upcoming",
    };
    const issues = validatePhases([a, b]);
    expect(issues.some((i) => i.severity === "error" && i.id.startsWith("phase-overlap"))).toBe(
      true,
    );
  });

  it("emits a warning when phases are not in chronological order", () => {
    const reversed = [...activeCampaignTimeline.phases].reverse();
    const issues = validatePhases(reversed);
    expect(issues.some((i) => i.severity === "warning" && i.fieldPath === "phases")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateScheduledSends
// ---------------------------------------------------------------------------

describe("validateScheduledSends", () => {
  it("returns no issues for valid sends in the active fixture", () => {
    const issues = validateScheduledSends(
      activeCampaignTimeline.sends,
      activeCampaignTimeline.phases,
    );
    expect(issues).toHaveLength(0);
  });

  it("emits an error for negative estimatedCount", () => {
    const badSend = { ...activeCampaignTimeline.sends[0], estimatedCount: -1 };
    const issues = validateScheduledSends([badSend], activeCampaignTimeline.phases);
    expect(
      issues.some((i) => i.severity === "error" && i.fieldPath.includes("estimatedCount")),
    ).toBe(true);
  });

  it("emits a warning when a send is outside its phase window", () => {
    const outsideSend = {
      ...activeCampaignTimeline.sends[0],
      id: "send-outside",
      scheduledAt: "2026-08-01T09:00",
    };
    const issues = validateScheduledSends([outsideSend], activeCampaignTimeline.phases);
    expect(
      issues.some((i) => i.severity === "warning" && i.fieldPath.includes("scheduledAt")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateMilestones
// ---------------------------------------------------------------------------

describe("validateMilestones", () => {
  it("returns no issues for valid milestones", () => {
    expect(validateMilestones(activeCampaignTimeline.milestones)).toHaveLength(0);
  });

  it("emits an error for an invalid dueAt value", () => {
    const bad = { ...activeCampaignTimeline.milestones[0], dueAt: "not-a-date" };
    const issues = validateMilestones([bad]);
    expect(issues.some((i) => i.severity === "error" && i.fieldPath.includes("dueAt"))).toBe(true);
  });

  it("emits a warning when resolvedAt is before dueAt for a non-skipped milestone", () => {
    const early = {
      ...activeCampaignTimeline.milestones[0],
      id: "ms-early",
      status: "resolved" as const,
      dueAt: "2026-06-10T09:00",
      resolvedAt: "2026-06-05T09:00",
    };
    const issues = validateMilestones([early]);
    expect(issues.some((i) => i.severity === "warning" && i.fieldPath.includes("resolvedAt"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// validatePreviewWindows
// ---------------------------------------------------------------------------

describe("validatePreviewWindows", () => {
  it("returns no issues for valid preview windows", () => {
    const issues = validatePreviewWindows(
      activeCampaignTimeline.previewWindows,
      activeCampaignTimeline.sends,
    );
    expect(issues).toHaveLength(0);
  });

  it("emits an error when closesAt <= opensAt", () => {
    const bad = {
      ...activeCampaignTimeline.previewWindows[0],
      opensAt: "2026-06-20T00:00",
      closesAt: "2026-06-10T00:00",
    };
    const issues = validatePreviewWindows([bad], activeCampaignTimeline.sends);
    expect(issues.some((i) => i.severity === "error" && i.fieldPath.includes("closesAt"))).toBe(
      true,
    );
  });

  it("emits a warning when a sendId does not exist", () => {
    const ghost = {
      ...activeCampaignTimeline.previewWindows[0],
      sendIds: ["send-ghost-999"],
    };
    const issues = validatePreviewWindows([ghost], activeCampaignTimeline.sends);
    expect(issues.some((i) => i.severity === "warning" && i.fieldPath.includes("sendIds"))).toBe(
      true,
    );
  });
});

// ---------------------------------------------------------------------------
// validateCampaignTimeline (integration)
// ---------------------------------------------------------------------------

describe("validateCampaignTimeline", () => {
  it("returns no issues for the active fixture", () => {
    expect(validateCampaignTimeline(activeCampaignTimeline)).toHaveLength(0);
  });

  it("returns no issues for the draft fixture", () => {
    expect(validateCampaignTimeline(draftCampaignTimeline)).toHaveLength(0);
  });

  it("returns no issues for an empty timeline", () => {
    const empty: CampaignTimeline = {
      id: "tl-empty",
      campaignId: "snap-000",
      phases: [],
      sends: [],
      milestones: [],
      previewWindows: [],
      createdAt: "2026-06-01T00:00",
      updatedAt: "2026-06-01T00:00",
    };
    expect(validateCampaignTimeline(empty)).toHaveLength(0);
  });
});
