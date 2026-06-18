import type { CampaignTimeline } from "../types/campaignTimeline";

/**
 * Reference clock: 2026-06-16T09:00 — matches DEMO_REFERENCE_NOW in snooze/referenceNow.ts.
 * All dates are hardcoded strings relative to that anchor.
 */

export const activeCampaignTimeline: CampaignTimeline = {
  id: "tl-001",
  campaignId: "snap-001",
  createdAt: "2026-05-01T10:00",
  updatedAt: "2026-06-10T14:30",
  phases: [
    {
      id: "phase-001",
      phaseKind: "planning",
      label: "Planning",
      startAt: "2026-05-01T00:00",
      endAt: "2026-05-14T23:59",
      status: "completed",
      description: "Define campaign goals, audience targeting, and draft messaging.",
    },
    {
      id: "phase-002",
      phaseKind: "warmup",
      label: "Warmup",
      startAt: "2026-05-15T00:00",
      endAt: "2026-05-31T23:59",
      status: "completed",
      description: "Gradually increase send volume to warm up relay reputation.",
    },
    {
      id: "phase-003",
      phaseKind: "active",
      label: "Active Send",
      startAt: "2026-06-01T00:00",
      endAt: "2026-06-22T23:59",
      status: "active",
      description: "Main campaign send window — full audience delivery.",
    },
    {
      id: "phase-004",
      phaseKind: "cooldown",
      label: "Cooldown",
      startAt: "2026-06-23T00:00",
      endAt: "2026-06-30T23:59",
      status: "upcoming",
      description: "Wind-down period; collect receipts and monitor delivery metrics.",
    },
  ],
  sends: [
    {
      id: "send-001",
      phaseId: "phase-003",
      label: "Investor Update — June Batch A",
      scheduledAt: "2026-06-05T09:00",
      recipientSegmentId: "investors",
      estimatedCount: 420,
      status: "sent",
      draftId: "draft-001",
    },
    {
      id: "send-002",
      phaseId: "phase-003",
      label: "Investor Update — June Batch B",
      scheduledAt: "2026-06-19T09:00",
      recipientSegmentId: "founders",
      estimatedCount: 185,
      status: "pending",
      draftId: "draft-002",
    },
    {
      id: "send-003",
      phaseId: "phase-004",
      label: "Relay Operator Notice",
      scheduledAt: "2026-06-25T11:00",
      recipientSegmentId: "relay-operators",
      estimatedCount: 62,
      status: "pending",
    },
  ],
  milestones: [
    {
      id: "ms-001",
      kind: "launch",
      label: "Campaign Launch",
      dueAt: "2026-06-01T09:00",
      resolvedAt: "2026-06-01T09:15",
      status: "resolved",
      note: "First send went out on schedule.",
    },
    {
      id: "ms-002",
      kind: "review",
      label: "Mid-Campaign Review",
      dueAt: "2026-06-23T10:00",
      status: "pending",
      note: "Review delivery rates and receipt confirmations before cooldown.",
    },
  ],
  previewWindows: [
    {
      id: "pw-001",
      label: "Active Phase Preview",
      opensAt: "2026-05-28T00:00",
      closesAt: "2026-06-22T23:59",
      associatedPhaseId: "phase-003",
      sendIds: ["send-001", "send-002"],
    },
  ],
};

export const draftCampaignTimeline: CampaignTimeline = {
  id: "tl-002",
  campaignId: "snap-002",
  createdAt: "2026-06-14T08:00",
  updatedAt: "2026-06-15T17:45",
  phases: [
    {
      id: "phase-005",
      phaseKind: "planning",
      label: "Planning",
      startAt: "2026-07-01T00:00",
      endAt: "2026-07-14T23:59",
      status: "upcoming",
      description: "Define scope and prepare audience lists for the Q3 campaign.",
    },
    {
      id: "phase-006",
      phaseKind: "warmup",
      label: "Warmup",
      startAt: "2026-07-15T00:00",
      endAt: "2026-07-31T23:59",
      status: "upcoming",
      description: "Gradual volume increase before the full send.",
    },
  ],
  sends: [
    {
      id: "send-004",
      phaseId: "phase-006",
      label: "Q3 Announcement — Early Access",
      scheduledAt: "2026-07-22T10:00",
      recipientSegmentId: "founders",
      estimatedCount: 310,
      status: "pending",
    },
  ],
  milestones: [
    {
      id: "ms-003",
      kind: "approval",
      label: "Legal & Compliance Sign-off",
      dueAt: "2026-06-30T17:00",
      status: "pending",
      note: "Required before any sends go out.",
    },
  ],
  previewWindows: [],
};
