export type CampaignPhaseKind =
  "planning" | "warmup" | "active" | "cooldown" | "completed" | "paused";

export type CampaignPhaseStatus = "upcoming" | "active" | "completed" | "skipped";

export type ScheduledSendStatus = "pending" | "sent" | "failed" | "cancelled";

export type MilestoneKind = "launch" | "review" | "approval" | "analysis" | "custom";

export type MilestoneStatus = "pending" | "resolved" | "overdue" | "skipped";

export interface CampaignPhase {
  id: string;
  phaseKind: CampaignPhaseKind;
  label: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  startAt: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  endAt: string;
  status: CampaignPhaseStatus;
  description?: string;
}

export interface ScheduledSend {
  id: string;
  /** References CampaignPhase.id */
  phaseId: string;
  label: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  scheduledAt: string;
  /** AudienceSegmentId string */
  recipientSegmentId: string;
  estimatedCount: number;
  status: ScheduledSendStatus;
  /** References Draft.id if linked to a draft */
  draftId?: string;
}

export interface Milestone {
  id: string;
  kind: MilestoneKind;
  label: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  dueAt: string;
  /** ISO local "yyyy-MM-ddTHH:mm" — set when status is "resolved" */
  resolvedAt?: string;
  status: MilestoneStatus;
  note?: string;
}

export interface PreviewWindow {
  id: string;
  label: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  opensAt: string;
  /** ISO local "yyyy-MM-ddTHH:mm" */
  closesAt: string;
  /** References CampaignPhase.id */
  associatedPhaseId?: string;
  /** ScheduledSend.id[] visible within this window */
  sendIds: string[];
}

export interface CampaignTimeline {
  id: string;
  /** References CampaignSnapshot id ("snap-*") */
  campaignId: string;
  phases: CampaignPhase[];
  sends: ScheduledSend[];
  milestones: Milestone[];
  previewWindows: PreviewWindow[];
  createdAt: string;
  updatedAt: string;
}
